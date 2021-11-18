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
    lpAmount: number,
    compoundRate: number,
    provide?:
      | { baseTokenAmount: number; denomTokenAmount: number; }
      | { provideAmount: number; returnAmount: number; price: string, returnAmountB?: number, priceB?: string },
  ) => {
    const isSpec = tokenASymbol === 'SPEC';

    let desc = 'Deposited';

    if (!provide) {
      desc += ` ${lpAmount} ${tokenASymbol}-${tokenBSymbol} LP`;
    } else if ('price' in provide) {
      const { provideAmount, returnAmount, price, returnAmountB, priceB } = provide;

      let lpDesc = `${lpAmount} ${tokenASymbol}-${tokenBSymbol} LP`;
      lpDesc += !isSpec ? ' (before deposit fee)' : '';

      if ('returnAmountB' in provide){
        desc += ` ${provideAmount} UST for ${lpDesc} which bought <br>${returnAmount} ${tokenBSymbol} at price ${price} UST, ${returnAmountB} ${tokenASymbol} at price ${priceB} ${tokenBSymbol}`;
      } else {
        desc += ` ${provideAmount} UST for ${lpDesc} which bought <br>${returnAmount} ${tokenASymbol} at price ${price} UST`;
      }
    } else {
      const { baseTokenAmount, denomTokenAmount } = provide;

      let lpDesc = `${lpAmount} LP`;
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
  withdrawFarm: (farm: string, baseTokenSymbol: string, denomTokenSymbol: string, lpAmount: number, demand?: { denomTokenAmount: number, baseTokenAmount?: number }) => {
    let desc = 'Withdrawn';

    const lp = `${lpAmount} ${baseTokenSymbol}-${denomTokenSymbol} LP`;

    if (!demand) {
      desc += ` ${lp}`;
    } else {
      const { denomTokenAmount, baseTokenAmount } = demand;
      desc += baseTokenAmount ? ` ${baseTokenAmount} ${baseTokenSymbol},` : '';
      desc += ` ${denomTokenAmount} ${denomTokenSymbol} (${lp})`;
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
      return JSON.parse(atob(executeMsg));
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
            await this.info.ensureCoinInfos();
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
    try{
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
    } catch (e){
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
    const lastSendMsg = lastMsg.execute_msg['send']?.msg ? ensureBase64toObject(lastMsg.execute_msg['send']?.msg) : undefined;
    const sendExecuteMsg = tryExtractExecuteMsgSend(lastMsg.execute_msg);

    const logs: Event[][] = txsItem?.logs?.map(log => log.events) ?? [];
    const [lastLogEvents] = logs.slice(-1);
    const fromContractEvent = lastLogEvents?.find(o => o.type === 'from_contract');

    if (lastMsg.execute_msg['swap'] && lastMsg.contract === this.terrajs.settings.specPool) {
      const ustOffer = +lastMsg.coins[0].amount / CONFIG.UNIT;
      const returnAmount = +fromContractEvent.attributes.find(o => o.key === 'return_amount').value / CONFIG.UNIT;
      const price = roundSixDecimal(ustOffer / returnAmount);

      return txHistoryFactory.buySpec(returnAmount, ustOffer, 'UST', price);
    }

    if (sendExecuteMsg?.msg['execute_swap_operations']?.operations[1]?.terra_swap?.ask_asset_info?.token?.contract_addr === this.terrajs.settings.specToken) {
      const executeSwapOperationsMsg = sendExecuteMsg?.msg['execute_swap_operations'];

      const offerAmount = +executeSwapOperationsMsg?.offer_amount / CONFIG.UNIT || 0;
      const rawReturnAmount = +fromContractEvent?.attributes.slice().reverse().find(o => o.key === 'return_amount')?.value;
      const returnAmount = rawReturnAmount / CONFIG.UNIT || 0;
      const price = roundSixDecimal(offerAmount / returnAmount);

      let offerToken: any;
      const offerAssetInfoTokenContract = executeSwapOperationsMsg?.operations[0]?.terra_swap?.offer_asset_info?.token?.contract_addr;
      if (offerAssetInfoTokenContract) {
        await this.info.ensureCw20tokensWhitelist();
        offerToken = this.info.cw20tokensWhitelist[this.terrajs?.network?.name ?? 'mainnet'][offerAssetInfoTokenContract]?.symbol
          ?? offerAssetInfoTokenContract;
      }

      return txHistoryFactory.buySpec(returnAmount, offerAmount, offerToken, price);
    }

    if (lastMsg.execute_msg['execute_swap_operations']?.operations[1].terra_swap?.ask_asset_info?.token?.contract_addr === this.terrajs.settings.specToken) {
      const executeSwapOperationsMsg = lastMsg.execute_msg['execute_swap_operations'];

      const offerDenom = executeSwapOperationsMsg?.operations[0]?.native_swap?.offer_denom;
      const offerAmount = +executeSwapOperationsMsg.offer_amount / CONFIG.UNIT || 0;
      const rawReturnAmount = +fromContractEvent?.attributes.slice().reverse().find(o => o.key === 'return_amount')?.value;
      const returnAmount = rawReturnAmount / CONFIG.UNIT || 0;
      const price = roundSixDecimal(offerAmount / returnAmount);

      return txHistoryFactory.buySpec(returnAmount, offerAmount, offerDenom, price);
    }

    if (lastSendMsg && lastSendMsg['swap'] && lastMsg.contract === this.terrajs.settings.specToken) {
      const offerAmount = +fromContractEvent?.attributes.find(o => o.key === 'offer_amount')?.value / CONFIG.UNIT || 0;
      const returnAmount = +fromContractEvent?.attributes.find(o => o.key === 'return_amount')?.value / CONFIG.UNIT || 0;
      const price = roundSixDecimal(returnAmount / offerAmount);

      return txHistoryFactory.sellSpec(offerAmount, returnAmount, 'UST', price);
    }

    if (sendExecuteMsg?.msg['execute_swap_operations'] && lastMsg.contract === this.terrajs.settings.specToken) {
      const rawReturnAmount = +fromContractEvent?.attributes.slice().reverse().find(o => o.key === 'return_amount')?.value;
      const offerAmount = +fromContractEvent?.attributes.find(o => o.key === 'offer_amount')?.value / CONFIG.UNIT || 0;
      const rawAskAsset = fromContractEvent?.attributes.slice().reverse().find(o => o.key === 'ask_asset')?.value;

      await this.info.ensureCw20tokensWhitelist();
      let askAsset = this.info.cw20tokensWhitelist[this.terrajs?.network?.name ?? 'mainnet'][rawAskAsset]?.symbol ?? rawAskAsset;
      let returnAmount = +rawReturnAmount / CONFIG.UNIT || 0;
      if (!askAsset) {
        const swapCoin = lastLogEvents?.find(o => o.type === 'swap')?.attributes.find(o => o.key === 'swap_coin')?.value;
        askAsset = swapCoin?.match(alphabetRegExp)[0];
        returnAmount = +swapCoin?.match(numberRegExp)[0] / CONFIG.UNIT || 0;
      }

      const price = roundSixDecimal(returnAmount / offerAmount);

      return txHistoryFactory.sellSpec(offerAmount, returnAmount, askAsset, price);
    }

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

        const assetToken = this.info.coinInfos[msg.execute_msg['withdraw'].asset_token];
        let poolName: string;

        if (assetToken) {
          poolName = `${assetToken}-${farmInfo.pairSymbol} pool`;
        } else if (farmInfo.tokenSymbol === 'MIR') {
          poolName = 'all pools';
        } else {
          poolName = `${farmInfo.baseSymbol || farmInfo.tokenSymbol}-${farmInfo.pairSymbol} pool`;
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

    if (sendExecuteMsg?.msg['bond'] && this.info.farmInfos.find(o => o.farmContract === sendExecuteMsg?.contract)) {
      const bondMsg = sendExecuteMsg.msg['bond'];

      const farmInfo = this.info.farmInfos.find(o => o.farmContract === sendExecuteMsg.contract);
      const farm = farmInfo?.farm;
      const lpAmount = +sendExecuteMsg.amount / CONFIG.UNIT || 0;
      const baseTokenSymbol = this.info.coinInfos[bondMsg.asset_token];
      const denomTokenSymbol = farmInfo?.pairSymbol;
      const compoundRate = +bondMsg.compound_rate;

      return txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, lpAmount, compoundRate);
    }

    if (lastMsg.execute_msg['bond'] && this.info.farmInfos.find(o => o.farmContract === lastMsg.execute_msg['bond'].contract)) {
      const bondMsg = lastMsg.execute_msg['bond'];
      const lpAmount = +fromContractEvent?.attributes.find(o => o.key === 'share')?.value / CONFIG.UNIT || 0;
      const taxAmount = +fromContractEvent?.attributes.find(o => o.key === 'tax_amount')?.value || 0;
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === bondMsg.contract);
      const farm = farmInfo?.farm;
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
          const symbol = this.info.coinInfos[asset.info?.token.contract_addr];
          if (symbol === farmInfo.pairSymbol) {
            denomTokenSymbol = symbol;
            denomTokenAmount = +asset.amount / CONFIG.UNIT;
          } else {
            baseTokenSymbol = symbol;
            baseTokenAmount = +asset.amount / CONFIG.UNIT;
          }
        }
      }

      return txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, lpAmount, compoundRate, { baseTokenAmount, denomTokenAmount });
    }

    if (lastMsg.execute_msg['zap_to_bond'] && lastMsg.contract === this.terrajs.settings.staker) {
      const zapToBondMsg = lastMsg.execute_msg['zap_to_bond'];

      const provideAmount = +fromContractEvent?.attributes.find(o => o.key === 'provide_amount')?.value / CONFIG.UNIT || 0;
      const offerAmount = +fromContractEvent?.attributes.find(o => o.key === 'offer_amount')?.value / CONFIG.UNIT || 0;
      const returnAmount = +fromContractEvent?.attributes.find(o => o.key === 'return_amount')?.value / CONFIG.UNIT || 0;
      const lpAmount = +fromContractEvent?.attributes.find(o => o.key === 'share')?.value / CONFIG.UNIT || 0;
      const price = roundSixDecimal(offerAmount / returnAmount);
      const compoundRate = +zapToBondMsg.compound_rate;
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === zapToBondMsg.contract);
      const farm = farmInfo?.farm;
      let baseTokenSymbol;
      let denomTokenSymbol;


      const pair_asset_b_token_contract_addr = zapToBondMsg.pair_asset_b?.token?.contract_addr;
      if (pair_asset_b_token_contract_addr){
        baseTokenSymbol = this.info.coinInfos[pair_asset_b_token_contract_addr];
        denomTokenSymbol = this.info.coinInfos[zapToBondMsg.pair_asset.token.contract_addr];
        const denomTokenAskAssetIndex = fromContractEvent?.attributes.findIndex(o => o.key === 'ask_asset' && o.value === pair_asset_b_token_contract_addr);
        const denomTokenOfferAmountKeyIndex = fromContractEvent?.attributes[+denomTokenAskAssetIndex + 1];
        const denomTokenReturnAmountKeyIndex = fromContractEvent?.attributes[+denomTokenAskAssetIndex + 2];
        const denomTokenOfferAmount = denomTokenOfferAmountKeyIndex.key === 'offer_amount' ? +denomTokenOfferAmountKeyIndex.value / CONFIG.UNIT || 0 : null;
        const denomReturnAmountDenom = denomTokenReturnAmountKeyIndex.key === 'return_amount' ? +denomTokenReturnAmountKeyIndex.value / CONFIG.UNIT || 0 : null;
        const priceDenom = roundSixDecimal(denomTokenOfferAmount / denomReturnAmountDenom);
        return txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, lpAmount, compoundRate, { provideAmount, returnAmount, price, returnAmountB: denomReturnAmountDenom, priceB: priceDenom });
      } else {
        baseTokenSymbol = this.info.coinInfos[zapToBondMsg.pair_asset.token.contract_addr];
        denomTokenSymbol = 'UST';
        return txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, lpAmount, compoundRate, { provideAmount, returnAmount, price });
      }
    }

    if (lastMsg.execute_msg['unbond'] && this.info.farmInfos.find(o => o.farmContract === lastMsg.contract)) {
      const unbondMsg = lastMsg.execute_msg['unbond'];

      const lpAmount = +unbondMsg.amount / CONFIG.UNIT;
      const baseTokenSymbol = this.info.coinInfos[unbondMsg.asset_token];
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === lastMsg.contract);
      const farm = farmInfo?.farm;
      const denomTokenSymbol = farmInfo?.pairSymbol;

      return txHistoryFactory.withdrawFarm(farm, baseTokenSymbol, denomTokenSymbol, lpAmount);
    }

    if (
      (sendExecuteMsg?.msg['withdraw_liquidity'] || sendExecuteMsg?.msg['zap_to_unbond']) &&
      this.info.farmInfos.find(o => o.farmContract === secondLastMsg?.contract)
    ) {
      const unbondMsg = secondLastMsg.execute_msg['unbond'];
      const withdrawLiquidityMsg = sendExecuteMsg.msg['withdraw_liquidity'];

      const lpAmount = +sendExecuteMsg.amount / CONFIG.UNIT;
      const tokenSymbol = this.info.coinInfos[unbondMsg.asset_token];
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === secondLastMsg.contract);
      const refundAssets = fromContractEvent.attributes.find(o => o.key === 'refund_assets')?.value.split(',');
      const [uusdAmount, tokenAmount] = (refundAssets[0].match(alphabetRegExp)[0] === 'uusd' ? refundAssets : [refundAssets[1], refundAssets[0]])
        .map(value => +value.match(numberRegExp)[0] / CONFIG.UNIT || 0); // TODO wait for zap to unbond to work
      const farm = farmInfo?.farm;
      const denomTokenSymbol = farmInfo?.pairSymbol;

      if (withdrawLiquidityMsg) {
        return txHistoryFactory.withdrawFarm(farm, tokenSymbol, denomTokenSymbol, lpAmount, { denomTokenAmount: uusdAmount, baseTokenAmount: tokenAmount });
      }

      const swappedAmount = +fromContractEvent.attributes.find(o => o.key === 'return_amount')?.value / CONFIG.UNIT || 0;
      const totalAmount = +plus(uusdAmount, swappedAmount);

      return txHistoryFactory.withdrawFarm(farm, tokenSymbol, denomTokenSymbol, lpAmount, { denomTokenAmount: totalAmount });
    }

    if (lastMsg.execute_msg['update_bond'] && this.info.farmInfos.find(o => o.farmContract === lastMsg.contract)) {
      const updateBondMsg = lastMsg.execute_msg['update_bond'];

      const tokenSymbol = this.info.coinInfos[updateBondMsg.asset_token];
      const totalLP = +updateBondMsg.amount_to_auto + +updateBondMsg.amount_to_stake;
      const rawAmountToAuto = updateBondMsg.amount_to_auto;
      const rawAmountToStake = updateBondMsg.amount_to_stake;
      const amountToAuto = +rawAmountToAuto / CONFIG.UNIT;
      const amountToStake = +rawAmountToStake / CONFIG.UNIT;
      const amountToAutoPercentage = this.percentPipe.transform(div(rawAmountToAuto, totalLP));
      const amountToStakePercentage = this.percentPipe.transform(div(rawAmountToStake, totalLP));
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === lastMsg.contract);

      return {
        action: 'Farm',
        desc: `Reallocated deposited ${tokenSymbol}-${farmInfo.pairSymbol} LP to auto-compound ${amountToAutoPercentage}, auto-stake ${amountToStakePercentage} (${amountToAuto} LP, ${amountToStake} LP) `,
      };
    }

    if (sendExecuteMsg?.msg['stake_tokens'] && sendExecuteMsg?.contract === this.terrajs.settings.gov) {
      const stakeTokensMsg = sendExecuteMsg?.msg['stake_tokens'];

      const pool = getGovPoolName(stakeTokensMsg.days);
      const amount = +sendExecuteMsg.amount / CONFIG.UNIT;

      return {
        action: 'Gov',
        desc: `Staked to ${pool} ${amount} SPEC`,
      };
    }

    if (lastMsg.execute_msg['withdraw'] && lastMsg.contract === this.terrajs.settings.gov) {
      const withdrawMsg = lastMsg.execute_msg['withdraw'];

      const pool = getGovPoolName(withdrawMsg.days);
      const amount = +withdrawMsg.amount / CONFIG.UNIT;

      return {
        action: 'Gov',
        desc: `Unstaked from ${pool} ${amount} SPEC`,
      };
    }

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

    if (lastMsg.execute_msg['poll_vote'] && lastMsg.contract === this.terrajs.settings.gov) {
      const pollVoteMsg = lastMsg.execute_msg['poll_vote'];

      return {
        action: 'Gov',
        desc: `Voted Poll ${pollVoteMsg.poll_id}`,
      };
    }

    if (lastMsg.execute_msg['poll_execute'] && lastMsg.contract === this.terrajs.settings.gov) {
      const pollExecuteMsg = lastMsg.execute_msg['poll_execute'];

      return {
        action: 'Gov',
        desc: `Executed Poll ${pollExecuteMsg.poll_id}`,
      };
    }

    if (sendExecuteMsg?.msg['poll_start'] && sendExecuteMsg?.contract === this.terrajs.settings.gov) {
      const pollStartMsg = sendExecuteMsg?.msg['poll_start'];

      return {
        action: 'Gov',
        desc: `Created Poll ${pollStartMsg.title}`,
      };
    }

    if (lastMsg.execute_msg['poll_end'] && lastMsg.contract === this.terrajs.settings.gov) {
      const pollEndMsg = lastMsg.execute_msg['poll_end'];

      return {
        action: 'Gov',
        desc: `Ended Poll ${pollEndMsg.poll_id}`,
      };
    }
  }
}
