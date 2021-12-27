import { Component, OnDestroy, OnInit } from '@angular/core';
import { TerrajsService } from '../../services/terrajs.service';
import { Subscription } from 'rxjs';
import { CONFIG } from '../../consts/config';
import { InfoService } from '../../services/info.service';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { div, plus, roundSixDecimal } from '../../libs/math';
import { PercentPipe } from '@angular/common';
import { Event, MsgExecuteContract } from '@terra-money/terra.js';
import { Denom } from '../../consts/denom';
import { fromBase64 } from 'src/app/libs/base64';
import { FARM_TYPE_ENUM } from '../../services/farm_info/farm-info.service';

interface TxHistory {
  desc: string;
  txhash: string;
  timestamp: Date;
  action: 'Farm' | 'Trade' | 'Gov';
  id: number;
}

const txHistoryFactory = {
  buySpec: (returnAmount: number, offerAmount: number, offerAsset: string, price: string) => ({
    action: 'Trade' as const,
    desc: `Bought ${returnAmount} SPEC for ${offerAmount} ${offerAsset} at price ${price} ${offerAsset}`,
  }),
  sellSpec: (offerAmount: number, returnAmount: number, returnAsset: string, price: string) => ({
    action: 'Trade' as const,
    desc: `Sold ${offerAmount} SPEC for ${returnAmount} ${returnAsset} at price ${price} ${returnAsset}`,
  }),
  unstakeRewards: (items: { farm: string; pool: string; specAmount: number; farmAmount?: number; tokenSymbol?: string }[]) => ({
    action: 'Farm' as const,
    desc: items
      .map(({ farm, pool, specAmount, farmAmount, tokenSymbol }) => {
        let desc = `Unstaked rewards from ${farm} farm, ${pool}`;
        desc += farmAmount && tokenSymbol ? `, ${farmAmount} ${tokenSymbol}` : '';
        desc += `, ${specAmount} SPEC`;

        return desc;
      })
      .join('<br>'),
  }),
  depositFarm: (
    farm: string,
    tokenASymbol: string,
    tokenBSymbol: string,
    amount: number,
    compoundRate: number,
    provide?:
      | { baseTokenAmount: number; denomTokenAmount: number; }
      | { provideAmount: number; returnAmount?: number; price?: string, returnAmountB?: number, priceB?: string, via?: string },
    farmType?: FARM_TYPE_ENUM,
  ) => {
    const isSpec = tokenASymbol === 'SPEC';

    let desc = 'Deposited';

    if (!provide) {
      if (farmType === 'PYLON_LIQUID') {
        desc += ` ${amount} ${tokenASymbol}`;
      } else {
        desc += ` ${amount} ${tokenASymbol}-${tokenBSymbol} LP`;
      }
      desc += !isSpec ? ' (before deposit fee)' : '';
    } else if ('provideAmount' in provide) {
      const { provideAmount, returnAmount, price, returnAmountB, priceB, via } = provide;

      let lpDesc: string = null;
      if (farmType === 'PYLON_LIQUID') {
        lpDesc = ` ${amount} ${tokenASymbol}`;
      } else {
        lpDesc = ` ${amount} ${tokenASymbol}-${tokenBSymbol} LP`;
      }
      lpDesc += !isSpec ? ' (before deposit fee)' : '';

      const viaDesc = via ? ' via ' + via : '';

      if ('returnAmountB' in provide) {
        desc += ` ${provideAmount} UST${viaDesc} for ${lpDesc} which bought <br>${returnAmount} ${tokenBSymbol} at price ${price} UST, ${returnAmountB} ${tokenASymbol} at price ${priceB} ${tokenBSymbol}`;
      } else if ('price' in provide) {
        desc += ` ${provideAmount} UST${viaDesc} for ${lpDesc} which bought <br>${returnAmount} ${tokenASymbol} at price ${price} UST`;
      } else {
        desc += ` ${provideAmount} UST${viaDesc} for ${lpDesc}`;
      }
    } else {
      const { baseTokenAmount, denomTokenAmount } = provide;

      let lpDesc = `${amount} LP`;
      lpDesc += !isSpec ? ' before deposit fee' : '';

      desc += ` ${baseTokenAmount} ${tokenASymbol} + ${denomTokenAmount} ${tokenBSymbol} (${lpDesc})`;
    }

    if (compoundRate === 1) {
      desc += ', auto-compound mode';
    } else if (!compoundRate) {
      desc += ', auto-stake mode';
    } else if (compoundRate > 0 && compoundRate < 1) {
      desc += `, auto-compound ${compoundRate * 100}% mode`;
    }

    desc += ` to ${farm} farm`;

    return { desc, action: 'Farm' as const };
  },
  withdrawFarm: (farm: string, baseTokenSymbol: string, denomTokenSymbol: string, amount: number, isWithdrawToUST: boolean, demand?: { tokenAAmount: number, tokenBAmount?: number }, farmType?: FARM_TYPE_ENUM) => {
    let desc = 'Withdrawn';
    let amountDesc = '';
    if (farmType === 'PYLON_LIQUID') {
      amountDesc = `${amount} ${baseTokenSymbol}`;
    } else {
      // farmType = LP OR null
      amountDesc = `${amount} ${baseTokenSymbol}-${denomTokenSymbol} LP`;
    }
    if (!demand) {
      desc += ` ${amountDesc}`;
    } else if (!isWithdrawToUST) {
      const { tokenAAmount, tokenBAmount } = demand;
      desc += tokenBAmount ? ` ${tokenBAmount} ${baseTokenSymbol},` : '';
      desc += ` ${tokenAAmount} ${denomTokenSymbol} (${amountDesc})`;
    } else {
      const { tokenAAmount } = demand;
      desc += ` ${tokenAAmount} UST (${amountDesc})`;
    }

    desc += ` from ${farm} farm`;

    return { desc, action: 'Farm' as const };
  },
};

const numberRegExp = /\d+/;
const alphabetRegExp = /[A-z]+/;

const getGovPoolName = (days?: number) => {
  if (!days) {
    return 'No Lock Pool';
  }

  return `${days}-Day Locked Pool`;
};

const ensureBase64toObject = (executeMsg: any): object => {
  const base64regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
  try {
    if (typeof executeMsg === 'string' && base64regex.test(executeMsg)) {
      return fromBase64(executeMsg);
    } else if (typeof executeMsg === 'object') {
      return executeMsg;
    } else {
      return {};
    }
  } catch (e) {
    console.error(e);
    return {};
  }
};

const tryExtractExecuteMsgSend = (executeMsg: object): { amount: string, contract: string, msg: object } | undefined => {
  if ('send' in executeMsg) {
    const send = executeMsg['send'];

    if ('amount' in send && 'contract' in send && 'msg' in send) {
      return { ...send, msg: ensureBase64toObject(send['msg']) };
    }
  }
};

@Component({
  selector: 'app-tx-history',
  templateUrl: './tx-history.component.html',
  styleUrls: ['./tx-history.component.scss'],
  providers: [PercentPipe]

})
export class TxHistoryComponent implements OnInit, OnDestroy {

  private connected: Subscription;
  loading = true;

  currentTxOffset = 0;
  offsetTxLimit = 100;
  txHistoryList: TxHistory[] = [];
  previousTxHistoryLength = 0;

  constructor(
    public info: InfoService,
    public terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
    private percentPipe: PercentPipe
  ) { }

  async ngOnInit() {
    this.$gaService.event('OPEN_TX_HISTORY_PAGE');
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        if (connected) {
          this.loading = true;
          if (this.txHistoryList.length === 0) {
            await this.info.ensureTokenInfos();
            await this.populateTxHistory();
          }
          this.loading = false;
        }
      });
  }

  ngOnDestroy() {
    this.connected.unsubscribe();
  }

  async loadMore() {
    if (this.loading) {
      return;
    }
    this.loading = true;
    await this.populateTxHistory();
    this.loading = false;
  }

  async populateTxHistory() {
    if (this.currentTxOffset === undefined) {
      return; // end of pagination txsRes.next is undefined
    }
    const queryParams: Record<string, string> = {
      offset: this.currentTxOffset.toString(),
      limit: this.offsetTxLimit.toString(),
      account: this.terrajs.address,
      chainId: this.terrajs.network.chainID
    };
    const txsRes = await this.terrajs.getFCD('v1/txs', queryParams);
    for (const item of txsRes.txs) {
      if (item.code) {
        continue;
      }
      const txHistory = await this.processTxItem(item);
      if (txHistory) {
        this.txHistoryList.push(txHistory);
      }
    }
    this.currentTxOffset = txsRes.next;
    if (this.previousTxHistoryLength === this.txHistoryList.length) {
      await this.populateTxHistory();
    } else {
      this.previousTxHistoryLength = this.txHistoryList.length;
    }
  }

  async processTxItem(txsItem: any): Promise<TxHistory> {
    try {
      const result = await this.interpretTxInfo(txsItem);
      if (!result) {
        return null;
      }

      return {
        ...result,
        id: txsItem.id,
        txhash: txsItem.txhash,
        timestamp: new Date(txsItem.timestamp),
      };
    } catch (e) {
      console.error('ERROR processTxItem >>', txsItem);
      console.error(e);
    }
  }

  async interpretTxInfo(txsItem: any): Promise<Pick<TxHistory, 'action' | 'desc'>> {
    if (!txsItem?.tx?.value?.msg) {
      return;
    }

    const msgs = (txsItem?.tx?.value?.msg.filter(m => m.type === 'wasm/MsgExecuteContract') as MsgExecuteContract.Data[])
      .map(data => ({ ...data.value, execute_msg: ensureBase64toObject(data.value.execute_msg) }));

    if (!msgs.length) {
      return;
    }

    const [secondLastMsg, lastMsg] = msgs.length === 1 ? [undefined, msgs[0]] : msgs.slice(-2);
    const sendExecuteMsg = tryExtractExecuteMsgSend(lastMsg.execute_msg);

    const logs: Event[][] = txsItem?.logs?.map(log => log.events) ?? [];
    const lastContractEvent = logs[logs.length - 1]?.find(o => o.type === 'from_contract');

    // Buy SPEC
    if (lastMsg.execute_msg['swap'] && lastMsg.contract === this.terrajs.settings.specPool) {
      const ustOffer = +lastMsg.coins[0].amount / CONFIG.UNIT;
      const returnAmount = +lastContractEvent.attributes.find(o => o.key === 'return_amount').value / CONFIG.UNIT;
      const price = roundSixDecimal(ustOffer / returnAmount);

      return txHistoryFactory.buySpec(returnAmount, ustOffer, 'UST', price);
    }

    // Sell SPEC
    if (sendExecuteMsg?.msg['swap'] && lastMsg.contract === this.terrajs.settings.specToken) {
      const offerAmount = +lastContractEvent?.attributes.find(o => o.key === 'offer_amount')?.value / CONFIG.UNIT || 0;
      const returnAmount = +lastContractEvent?.attributes.find(o => o.key === 'return_amount')?.value / CONFIG.UNIT || 0;
      const price = roundSixDecimal(returnAmount / offerAmount);

      return txHistoryFactory.sellSpec(offerAmount, returnAmount, 'UST', price);
    }

    // Claim rewards
    if (
      (lastMsg.execute_msg['withdraw'] && this.info.farmInfos.find(o => o.farmContract === lastMsg.contract)) ||
      (secondLastMsg?.execute_msg['withdraw'] && this.info.farmInfos.find(o => o.farmContract === secondLastMsg?.contract))
    ) {
      const unstakes: Parameters<typeof txHistoryFactory['unstakeRewards']>[0] = [];

      for (let index = 0; index < msgs.length; index++) {
        const msg = msgs[index];
        const events = logs[index];
        const farmInfo = this.info.farmInfos.find(it => it.farmContract === msg.contract);

        if (!farmInfo) {
          continue;
        }

        const assetToken = this.info.tokenInfos[msg.execute_msg['withdraw'].asset_token]?.symbol;
        let poolName: string;

        if (assetToken) {
          if (farmInfo.farmType === 'PYLON_LIQUID') {
            poolName = `${assetToken} pool`;
          } else {
            poolName = `${assetToken}-${farmInfo.pairSymbol} pool`;
          }
        } else if (farmInfo.tokenSymbol === 'MIR') {
          poolName = 'all pools';
        } else {
          if (farmInfo.farmType === 'PYLON_LIQUID') {
            poolName = `${farmInfo.baseSymbol || farmInfo.tokenSymbol} pool`;
          } else {
            poolName = `${farmInfo.baseSymbol || farmInfo.tokenSymbol}-${farmInfo.pairSymbol} pool`;
          }
        }

        if (farmInfo.tokenSymbol !== 'SPEC') {
          const event = events?.find(o => o.type === 'from_contract');
          const farmAmount = +event?.attributes.find(o => o.key === 'farm_amount')?.value / CONFIG.UNIT || 0;
          const specAmount = +event?.attributes.find(o => o.key === 'spec_amount')?.value / CONFIG.UNIT || 0;
          unstakes.push({ farm: farmInfo.farm, pool: poolName, farmAmount, tokenSymbol: farmInfo.tokenSymbol, specAmount });
        } else {
          const event = events?.find(o => o.type === 'from_contract');
          const specAmount = +event?.attributes.find(o => o.key === 'amount')?.value / CONFIG.UNIT || 0;
          unstakes.push({ farm: farmInfo.farm, pool: poolName, specAmount });
        }
      }

      const txHistory = txHistoryFactory.unstakeRewards(unstakes);

      if (sendExecuteMsg) {
        const farmInfo = this.info.farmInfos.find(it => it.farmGovContract === sendExecuteMsg.contract);

        if (farmInfo) {
          txHistory.desc += '<br>';
          const amount = lastMsg.execute_msg['send']?.amount / CONFIG.UNIT;
          if (farmInfo.tokenSymbol === 'SPEC') {
            const stakeTokensMsg = sendExecuteMsg?.msg['stake_tokens'];
            txHistory.desc += `and staked to Spectrum Gov ${getGovPoolName(stakeTokensMsg.days)} ${amount} ${farmInfo.tokenSymbol}`;
          } else {
            txHistory.desc += `and staked to ${farmInfo.farm} Gov ${amount} ${farmInfo.tokenSymbol}`;
          }
        }
      }

      return txHistory;
    }

    // Zap to bond (single asset)
    let zapSingleAsset: string = null;
    if (msgs[0]?.execute_msg['zap_to_bond'] && msgs[0]?.contract === this.terrajs.settings.stakerSingleAsset) {
      const zapToBondMsg = msgs[0].execute_msg['zap_to_bond'];

      const firstContractEvent = logs[0]?.find(o => o.type === 'from_contract');
      const provideAmount = +zapToBondMsg.provide_asset?.amount / CONFIG.UNIT || 0;
      const offerAmount = +firstContractEvent?.attributes.find(o => o.key === 'offer_amount')?.value / CONFIG.UNIT || 0;
      const returnAmount = +firstContractEvent?.attributes.reverse().find(o => o.key === 'return_amount')?.value / CONFIG.UNIT || 0;
      const price = roundSixDecimal(offerAmount / returnAmount);
      const compoundRate = +zapToBondMsg.compound_rate;
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === zapToBondMsg.contract);
      const farm = farmInfo?.farm;

      const via = 'Terraswap';
      const result = txHistoryFactory.depositFarm(farm, farmInfo.pairSymbol, undefined, returnAmount, compoundRate, { provideAmount, returnAmount, price, via }, farmInfo.farmType);
      zapSingleAsset = result.desc;
    }

    // Bond with LP
    if (sendExecuteMsg?.msg['bond'] && this.info.farmInfos.find(o => o.farmContract === sendExecuteMsg?.contract)) {
      const bondMsg = sendExecuteMsg.msg['bond'];
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === sendExecuteMsg.contract);
      const farm = farmInfo?.farm;
      const amount = +sendExecuteMsg.amount / CONFIG.UNIT || 0;
      const compoundRate = +bondMsg.compound_rate;
      const baseTokenSymbol = this.info.tokenInfos[bondMsg.asset_token]?.symbol;
      const denomTokenSymbol = farmInfo?.pairSymbol;

      const depositMsg = msgs[msgs.length - 3];
      const liquidInfo = farmInfo.pylonLiquidInfo;
      if (depositMsg?.contract === liquidInfo?.dpPool && depositMsg?.execute_msg?.['deposit']) {
        const provideAmount = +depositMsg.coins.find(it => it.denom === Denom.USD)?.amount / CONFIG.UNIT || 0;
        const via = 'Pylon pool';
        const result = txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, amount, compoundRate, { provideAmount, via }, farmInfo.farmType);
        if (zapSingleAsset) {
          return { desc: zapSingleAsset + '<br>' + result.desc, action: 'Farm' };
        } else {
          return result;
        }
      }
      return txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, amount, compoundRate, null, farmInfo.farmType);
    } else if (zapSingleAsset) {
      return { desc: zapSingleAsset, action: 'Farm' };
    }

    // Bond with Token(s)
    if (lastMsg.execute_msg['bond'] && this.info.farmInfos.find(o => o.farmContract === lastMsg.execute_msg['bond'].contract)) {
      const bondMsg = lastMsg.execute_msg['bond'];
      const lpAmount = +lastContractEvent?.attributes.find(o => o.key === 'share')?.value / CONFIG.UNIT || 0;
      const taxAmount = +lastContractEvent?.attributes.find(o => o.key === 'tax_amount')?.value || 0;
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === bondMsg.contract);
      const farm = farmInfo.farm;
      const compoundRate = +bondMsg.compound_rate;

      let denomTokenSymbol = '';
      let denomTokenAmount = 0;
      let baseTokenSymbol = '';
      let baseTokenAmount = 0;
      for (const asset of bondMsg.assets ?? []) {
        if (asset.info?.native_token?.denom === Denom.USD) {
          denomTokenSymbol = farmInfo?.pairSymbol;
          denomTokenAmount = (+asset.amount - +taxAmount) / CONFIG.UNIT;
        } else if (asset.info?.token) {
          const symbol = this.info.tokenInfos[asset.info?.token.contract_addr]?.symbol;
          if (symbol === farmInfo.pairSymbol) {
            denomTokenSymbol = symbol;
            denomTokenAmount = +asset.amount / CONFIG.UNIT;
          } else {
            baseTokenSymbol = symbol;
            baseTokenAmount = +asset.amount / CONFIG.UNIT;
          }
        }
      }

      return txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, lpAmount, compoundRate, { baseTokenAmount, denomTokenAmount }, 'LP');
    }

    // Bond with UST
    if (lastMsg.execute_msg['zap_to_bond'] && lastMsg.contract === this.terrajs.settings.staker) {
      const zapToBondMsg = lastMsg.execute_msg['zap_to_bond'];

      const provideAmount = +lastContractEvent?.attributes.find(o => o.key === 'provide_amount')?.value / CONFIG.UNIT || 0;
      const offerAmount = +lastContractEvent?.attributes.find(o => o.key === 'offer_amount')?.value / CONFIG.UNIT || 0;
      const returnAmount = +lastContractEvent?.attributes.find(o => o.key === 'return_amount')?.value / this.info.tokenInfos[zapToBondMsg.pair_asset.token.contract_addr]?.unit || 0;
      const lpAmount = +lastContractEvent?.attributes.find(o => o.key === 'share')?.value / CONFIG.UNIT || 0;
      const price = roundSixDecimal(offerAmount / returnAmount);
      const compoundRate = +zapToBondMsg.compound_rate;
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === zapToBondMsg.contract);
      const farm = farmInfo?.farm;

      const pair_asset_b_token_contract_addr = zapToBondMsg.pair_asset_b?.token?.contract_addr;
      if (pair_asset_b_token_contract_addr) {
        const baseTokenSymbol = this.info.tokenInfos[pair_asset_b_token_contract_addr]?.symbol;
        const denomTokenSymbol = this.info.tokenInfos[zapToBondMsg.pair_asset.token.contract_addr]?.symbol;
        const denomTokenAskAssetIndex = lastContractEvent?.attributes.findIndex(o => o.key === 'ask_asset' && o.value === pair_asset_b_token_contract_addr);
        const denomTokenOfferAmountKeyIndex = lastContractEvent?.attributes[+denomTokenAskAssetIndex + 1];
        const denomTokenReturnAmountKeyIndex = lastContractEvent?.attributes[+denomTokenAskAssetIndex + 2];
        const denomTokenOfferAmount = denomTokenOfferAmountKeyIndex.key === 'offer_amount' ? +denomTokenOfferAmountKeyIndex.value / CONFIG.UNIT || 0 : null;
        const denomReturnAmountDenom = denomTokenReturnAmountKeyIndex.key === 'return_amount' ? +denomTokenReturnAmountKeyIndex.value / CONFIG.UNIT || 0 : null;
        const priceDenom = roundSixDecimal(denomTokenOfferAmount / denomReturnAmountDenom);
        return txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, lpAmount, compoundRate, { provideAmount, returnAmount, price, returnAmountB: denomReturnAmountDenom, priceB: priceDenom }, 'LP');
      } else {
        const baseTokenSymbol = this.info.tokenInfos[zapToBondMsg.pair_asset.token.contract_addr]?.symbol;
        const denomTokenSymbol = 'UST';
        return txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, lpAmount, compoundRate, { provideAmount, returnAmount, price }, 'LP');
      }
    }

    // Unbond as LP (and swap)
    if (msgs[0]?.execute_msg['unbond'] &&
      this.info.farmInfos.find(o => o.farmContract === msgs[0].contract) &&
      !(sendExecuteMsg?.msg['withdraw_liquidity'] || sendExecuteMsg?.msg['zap_to_unbond'])
    ) {
      const unbondMsg = msgs[0].execute_msg['unbond'];

      const amount = +unbondMsg.amount / CONFIG.UNIT;
      const baseTokenSymbol = this.info.tokenInfos[unbondMsg.asset_token]?.symbol;
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === msgs[0].contract);
      const farm = farmInfo?.farm;
      const denomTokenSymbol = farmInfo?.pairSymbol;

      if (!sendExecuteMsg?.msg['execute_swap_operations']) {
        return txHistoryFactory.withdrawFarm(farm, baseTokenSymbol, denomTokenSymbol, amount, false, null, farmInfo.farmType);
      }

      const totalAmount = +lastContractEvent.attributes.reverse().find(o => o.key === 'return_amount')?.value / CONFIG.UNIT || 0;

      return txHistoryFactory.withdrawFarm(farm, baseTokenSymbol, denomTokenSymbol, amount, true, { tokenAAmount: totalAmount }, farmInfo.farmType);
    }

    // Unbond as token+UST & Unbond as UST
    if (
      (sendExecuteMsg?.msg['withdraw_liquidity'] || sendExecuteMsg?.msg['zap_to_unbond']) &&
      this.info.farmInfos.find(o => o.farmContract === secondLastMsg?.contract)
    ) {
      const unbondMsg = secondLastMsg.execute_msg['unbond'];
      const withdrawLiquidityMsg = sendExecuteMsg.msg['withdraw_liquidity'];

      const lpAmount = +sendExecuteMsg.amount / CONFIG.UNIT;
      const tokenSymbol = this.info.tokenInfos[unbondMsg.asset_token]?.symbol;
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === secondLastMsg.contract);
      const refundAssets = lastContractEvent.attributes.find(o => o.key === 'refund_assets')?.value.split(',');
      const [uusdAmountRaw, tokenAmountRaw] = (refundAssets[0].match(alphabetRegExp)[0] === 'uusd' ? refundAssets : [refundAssets[1], refundAssets[0]])
        .map(value => +value.match(numberRegExp)[0] || 0);
      const uusdAmount = uusdAmountRaw / CONFIG.UNIT;
      const tokenAmount = tokenAmountRaw / this.info.tokenInfos[unbondMsg.asset_token]?.unit;
      const farm = farmInfo?.farm;
      const denomTokenSymbol = farmInfo?.pairSymbol;
      if (withdrawLiquidityMsg) {
        return txHistoryFactory.withdrawFarm(farm, tokenSymbol, denomTokenSymbol, lpAmount, false, { tokenAAmount: uusdAmount, tokenBAmount: tokenAmount });
      }

      const zap_to_unbond = ensureBase64toObject(sendExecuteMsg?.msg['zap_to_unbond']);
      if (zap_to_unbond['sell_asset_b']) {
        const uusdAskAssetIndex = lastContractEvent?.attributes.findIndex(o => o.key === 'ask_asset' && o.value === Denom.USD);
        const uusdReturnAmountKeyIndex = lastContractEvent?.attributes[+uusdAskAssetIndex + 2];
        const uusdReturnAmount = uusdReturnAmountKeyIndex.key === 'return_amount' ? +uusdReturnAmountKeyIndex.value / CONFIG.UNIT || 0 : null;

        return txHistoryFactory.withdrawFarm(farm, tokenSymbol, denomTokenSymbol, lpAmount, true, { tokenAAmount: uusdReturnAmount });

      } else {
        const swappedAmount = +lastContractEvent.attributes.find(o => o.key === 'return_amount')?.value / CONFIG.UNIT || 0;
        const totalAmount = +plus(uusdAmount, swappedAmount);

        return txHistoryFactory.withdrawFarm(farm, tokenSymbol, denomTokenSymbol, lpAmount, true, { tokenAAmount: totalAmount });
      }
    }

    // Update Bond
    if (lastMsg.execute_msg['update_bond'] && this.info.farmInfos.find(o => o.farmContract === lastMsg.contract)) {
      const updateBondMsg = lastMsg.execute_msg['update_bond'];

      const tokenSymbol = this.info.tokenInfos[updateBondMsg.asset_token]?.symbol;
      const totalLP = +updateBondMsg.amount_to_auto + +updateBondMsg.amount_to_stake;
      const rawAmountToAuto = updateBondMsg.amount_to_auto;
      const rawAmountToStake = updateBondMsg.amount_to_stake;
      const amountToAuto = +rawAmountToAuto / CONFIG.UNIT;
      const amountToStake = +rawAmountToStake / CONFIG.UNIT;
      const amountToAutoPercentage = this.percentPipe.transform(div(rawAmountToAuto, totalLP));
      const amountToStakePercentage = this.percentPipe.transform(div(rawAmountToStake, totalLP));
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === lastMsg.contract);
      let assetDesc = '';
      if (farmInfo.farmType === 'PYLON_LIQUID') {
        assetDesc = `${tokenSymbol}`;
      } else {
        assetDesc = `${tokenSymbol}-${farmInfo.pairSymbol} LP`;
      }
      return {
        action: 'Farm',
        desc: `Reallocated deposited ${assetDesc} to auto-compound ${amountToAutoPercentage}, auto-stake ${amountToStakePercentage} (${amountToAuto} LP, ${amountToStake} LP) `,
      };
    }

    // Stake to Gov
    if (sendExecuteMsg?.msg['stake_tokens'] && sendExecuteMsg?.contract === this.terrajs.settings.gov) {
      const stakeTokensMsg = sendExecuteMsg?.msg['stake_tokens'];

      const pool = getGovPoolName(stakeTokensMsg.days);
      const amount = +sendExecuteMsg.amount / CONFIG.UNIT;

      return {
        action: 'Gov',
        desc: `Staked to ${pool} ${amount} SPEC`,
      };
    }

    // Withdraw from Gov
    if (lastMsg.execute_msg['withdraw'] && lastMsg.contract === this.terrajs.settings.gov) {
      const withdrawMsg = lastMsg.execute_msg['withdraw'];

      const pool = getGovPoolName(withdrawMsg.days);
      const amount = +withdrawMsg.amount / CONFIG.UNIT;

      return {
        action: 'Gov',
        desc: `Unstaked from ${pool} ${amount} SPEC`,
      };
    }

    // Update Gov staking
    if (lastMsg.execute_msg['update_stake'] && lastMsg.contract === this.terrajs.settings.gov) {
      const updateStakeMsg = lastMsg.execute_msg['update_stake'];

      const fromPool = getGovPoolName(updateStakeMsg.from_days);
      const toPool = getGovPoolName(updateStakeMsg.to_days);
      const amount = +updateStakeMsg.amount / CONFIG.UNIT;

      return {
        action: 'Gov',
        desc: `Moved staking ${amount} SPEC from ${fromPool} to ${toPool}`,
      };
    }

    // Harvest
    if (msgs[0].execute_msg['harvest'] && msgs[0].contract === this.terrajs.settings.gov) {
      const pool = getGovPoolName(msgs[0].execute_msg['harvest'].days);

      if (sendExecuteMsg?.contract === this.terrajs.settings.anchorMarket) {
        const uusd = lastContractEvent?.attributes.find(it => it.key === 'redeem_amount')?.value;
        if (uusd) {
          return {
            action: 'Gov',
            desc: `Claim ${+uusd / CONFIG.UNIT} UST from ${pool}`,
          };
        }
      }

      return {
        action: 'Gov',
        desc: `Claim ${+msgs[0].execute_msg['harvest'].aust_amount / CONFIG.UNIT} aUST from ${pool}`,
      };
    }

    // Poll vote
    if (lastMsg.execute_msg['poll_vote'] && lastMsg.contract === this.terrajs.settings.gov) {
      const pollVoteMsg = lastMsg.execute_msg['poll_vote'];

      return {
        action: 'Gov',
        desc: `Voted Poll ${pollVoteMsg.poll_id}`,
      };
    }

    // Poll execute
    if (lastMsg.execute_msg['poll_execute'] && lastMsg.contract === this.terrajs.settings.gov) {
      const pollExecuteMsg = lastMsg.execute_msg['poll_execute'];

      return {
        action: 'Gov',
        desc: `Executed Poll ${pollExecuteMsg.poll_id}`,
      };
    }

    // Poll create
    if (sendExecuteMsg?.msg['poll_start'] && sendExecuteMsg?.contract === this.terrajs.settings.gov) {
      const pollStartMsg = sendExecuteMsg?.msg['poll_start'];

      return {
        action: 'Gov',
        desc: `Created Poll ${pollStartMsg.title}`,
      };
    }

    // Poll end
    if (lastMsg.execute_msg['poll_end'] && lastMsg.contract === this.terrajs.settings.gov) {
      const pollEndMsg = lastMsg.execute_msg['poll_end'];

      return {
        action: 'Gov',
        desc: `Ended Poll ${pollEndMsg.poll_id}`,
      };
    }
  }
}
