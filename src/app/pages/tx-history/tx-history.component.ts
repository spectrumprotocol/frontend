import {Component, OnDestroy, OnInit} from '@angular/core';
import {TerrajsService} from '../../services/terrajs.service';
import {Subscription} from 'rxjs';
import {CONFIG} from '../../consts/config';
import {InfoService} from '../../services/info.service';
import {GoogleAnalyticsService} from 'ngx-google-analytics';
import {div, plus, roundSixDecimal} from '../../libs/math';
import {PercentPipe} from '@angular/common';
import {Event} from '@terra-money/terra.js';
import {Denom} from '../../consts/denom';
import {fromBase64} from '../../libs/base64';
import {
  FARM_TYPE_DEPOSIT_WITH_SINGLE_CW20TOKEN,
  FARM_TYPE_DISPLAY_AS_SINGLE_TOKEN,
  FARM_TYPE_ENUM
} from '../../services/farm_info/farm-info.service';

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
  unstakeRewards: (items: { farm: string; pool: string; specAmount: number; farmAmount?: number; farmSymbol?: string; farm2Amount?: number; farm2Symbol?: string }[]) => ({
    action: 'Farm' as const,
    desc: items
      .map(({farm, pool, specAmount, farmAmount, farmSymbol, farm2Amount, farm2Symbol}) => {
        let desc = `Unstaked rewards from ${farm} farm, ${pool}`;
        desc += farmAmount && farmSymbol ? `, ${farmAmount} ${farmSymbol}` : '';
        desc += farm2Amount && farm2Symbol ? `, ${farm2Amount} ${farm2Symbol}` : '';
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
    _dex: string,
    provide?:
      | { baseTokenAmount: number; denomTokenAmount: number; }
      | { provideAmount: number; returnAmount?: number; price?: string, returnAmountB?: number, priceB?: string, via?: string },
    farmType?: FARM_TYPE_ENUM,
    farmContract?: string,
  ) => {
    const isSpec = tokenASymbol === 'SPEC'; // TODO may need to check with farmContract in the future

    let desc = 'Deposited';

    if (!provide) {
      if (FARM_TYPE_DEPOSIT_WITH_SINGLE_CW20TOKEN.has(farmType)) {
        desc += ` ${amount} ${tokenASymbol}`;
      } else if ( farmType === 'BORROWED') {
        desc += ` ${amount} UST`;
      } else {
        desc += ` ${amount} ${tokenASymbol}-${tokenBSymbol} LP`;
      }
      desc += !isSpec ? ' (before deposit fee)' : '';
    } else if ('provideAmount' in provide) {
      const {provideAmount, returnAmount, price, returnAmountB, priceB, via} = provide;

      let lpDesc: string = null;
      if (FARM_TYPE_DEPOSIT_WITH_SINGLE_CW20TOKEN.has(farmType)) {
        lpDesc = ` ${amount} ${tokenASymbol}`;
      } else if ( farmType === 'BORROWED') {
        desc += ` ${amount} UST`;
      } else {
        lpDesc = ` ${amount} ${tokenASymbol}-${tokenBSymbol} LP`;
      }
      lpDesc += !isSpec ? ' (before deposit fee)' : '';

      const viaDesc = via ? ' via ' + via : '';

      if ('returnAmountB' in provide && returnAmountB) {
        desc += ` ${provideAmount} UST${viaDesc} for ${lpDesc} which bought <br>${returnAmount} ${tokenBSymbol} at price ${price} UST, ${returnAmountB} ${tokenASymbol} at price ${priceB} ${tokenBSymbol}`;
      } else if ('returnAmountB' in provide && !returnAmountB) {
        desc += ` ${provideAmount} UST${viaDesc} for ${lpDesc} which bought <br>${returnAmount} ${tokenBSymbol} at price ${price} UST`;
      } else if ('price' in provide) {
        desc += ` ${provideAmount} UST${viaDesc} for ${lpDesc} which bought <br>${returnAmount} ${tokenASymbol} at price ${price} UST`;
      } else {
        desc += ` ${provideAmount} UST${viaDesc} for ${lpDesc}`;
      }
    } else {
      const {baseTokenAmount, denomTokenAmount} = provide;

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

    return {desc, action: 'Farm' as const};
  },
  withdrawFarm: (farm: string, baseTokenSymbol: string, denomTokenSymbol: string, amount: number, isWithdrawToUST: boolean, dex: string, demand?: { tokenAAmount: number, tokenBAmount?: number }, farmType?: FARM_TYPE_ENUM) => {
    let desc = 'Withdrawn';
    let amountDesc = '';
    if (FARM_TYPE_DEPOSIT_WITH_SINGLE_CW20TOKEN.has(farmType)) {
      amountDesc = `${amount} ${baseTokenSymbol}`;
    } else if ( farmType === 'BORROWED') {
      desc += ` ${amount} UST`;
    } else {
      // farmType = ${dex} LP OR null
      amountDesc = `${amount} ${baseTokenSymbol}-${denomTokenSymbol} LP`;
    }
    if (!demand) {
      desc += ` ${amountDesc}`;
    } else if (!isWithdrawToUST) {
      const {tokenAAmount, tokenBAmount} = demand;
      desc += tokenBAmount ? ` ${tokenBAmount} ${denomTokenSymbol},` : '';
      desc += ` ${tokenAAmount} ${baseTokenSymbol} (${amountDesc})`;
    } else {
      const {tokenAAmount} = demand;
      desc += ` ${tokenAAmount} UST (${amountDesc})`;
    }

    if (farmType === 'BORROWED') {
      desc += ` from ${farm} ${baseTokenSymbol}-${denomTokenSymbol} borrowed farm`;
    } else if (FARM_TYPE_DISPLAY_AS_SINGLE_TOKEN.has(farmType)) {
      desc += ` from ${farm} ${baseTokenSymbol} farm`;
    } else {
      desc += ` from ${farm} ${baseTokenSymbol}-${denomTokenSymbol} farm`;
    }

    return {desc, action: 'Farm' as const};
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
      return {...send, msg: ensureBase64toObject(send['msg'])};
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

  loading = true;
  currentTxOffset = 0;
  offsetTxLimit = 100;
  txHistoryList: TxHistory[] = [];
  previousTxHistoryLength = 0;
  poolInfoKeys: string[];
  private connected: Subscription;

  constructor(
    public info: InfoService,
    public terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
    private percentPipe: PercentPipe
  ) {
  }

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

  getSymbol(contract_addr: string) {
    if (contract_addr?.startsWith('u')) {
      return Denom.display[contract_addr];
    } else {
      return this.info.tokenInfos[contract_addr]?.symbol;
    }
  }

  async interpretTxInfo(txsItem: any): Promise<Pick<TxHistory, 'action' | 'desc'>> {
    if (!txsItem?.tx?.value?.msg) {
      return;
    }
    const msgs = (txsItem?.tx?.value?.msg.filter(m => m.type === 'wasm/MsgExecuteContract') as any)
      .map(data => ({...data.value, execute_msg: ensureBase64toObject(data.value.execute_msg)}));

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

        const baseTokenContract = msg.execute_msg['withdraw'].asset_token;
        const baseSymbol = this.getSymbol(baseTokenContract);
        let poolName: string;
        if (baseSymbol) {
          if (FARM_TYPE_DEPOSIT_WITH_SINGLE_CW20TOKEN.has(farmInfo.farmType)) {
            poolName = `${baseSymbol} pool`;
          } else {
            const denomSymbol = this.getSymbol(farmInfo.denomTokenContract);
            poolName = `${baseSymbol}-${denomSymbol} pool`;
          }
        } else if (farmInfo.rewardTokenContract === this.terrajs.settings.mirrorToken) {
          poolName = 'all pools';
        } else {
          if (FARM_TYPE_DEPOSIT_WITH_SINGLE_CW20TOKEN.has(farmInfo.farmType)) {
            poolName = `${this.getSymbol(farmInfo.defaultBaseTokenContract)} pool`;
          } else {
            poolName = `${this.getSymbol(farmInfo.defaultBaseTokenContract)}-${this.getSymbol(farmInfo.denomTokenContract)} ${farmInfo.dex} pool`;
          }
        }

        if (farmInfo.rewardTokenContract !== this.terrajs.settings.specToken) {
          const event = events?.find(o => o.type === 'from_contract');
          const farmAmount = +event?.attributes.find(o => o.key === 'farm_amount')?.value / this.getUnit(farmInfo.rewardTokenContract) || 0;
          const specAmount = +event?.attributes.find(o => o.key === 'spec_amount')?.value / CONFIG.UNIT || 0;
          const farmSymbol = farmInfo.dex === 'Astroport' && farmInfo.farmType === 'LP' ? this.getSymbol(this.terrajs.settings.astroToken) : this.getSymbol(farmInfo.rewardTokenContract);
          const farm2Symbol = farmInfo.dex === 'Astroport' && farmInfo.hasProxyReward && farmInfo.farmType === 'LP' ? this.getSymbol(farmInfo.rewardTokenContract) : undefined;
          const farm2Amount = +event?.attributes.find(o => o.key === 'farm2_amount')?.value / this.getUnit(farmInfo.rewardTokenContract) || 0;

          unstakes.push({
            farm: farmInfo.farm,
            pool: poolName,
            farmAmount,
            farmSymbol,
            specAmount,
            farm2Symbol,
            farm2Amount
          });
        } else {
          const event = events?.find(o => o.type === 'from_contract');
          const specAmount = +event?.attributes.find(o => o.key === 'amount')?.value / CONFIG.UNIT || 0;
          unstakes.push({farm: farmInfo.farm, pool: poolName, specAmount});
        }
      }

      const txHistory = txHistoryFactory.unstakeRewards(unstakes);

      if (sendExecuteMsg) {
        const farmInfo = this.info.farmInfos.find(it => it.farmGovContract === sendExecuteMsg.contract);

        if (farmInfo) {
          txHistory.desc += '<br>';
          const amount = lastMsg.execute_msg['send']?.amount / CONFIG.UNIT;
          if (farmInfo.rewardTokenContract === this.terrajs.settings.specToken) {
            const stakeTokensMsg = sendExecuteMsg?.msg['stake_tokens'];
            txHistory.desc += `and staked to Spectrum Gov ${getGovPoolName(stakeTokensMsg.days)} ${amount} ${this.getSymbol(farmInfo.rewardTokenContract)}`;
          } else {
            txHistory.desc += `and staked to ${farmInfo.farm} Gov ${amount} ${this.getSymbol(farmInfo.rewardTokenContract)}`;
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

      const via = farmInfo.dex;
      const result = txHistoryFactory.depositFarm(farm, this.getSymbol(farmInfo.defaultBaseTokenContract), undefined, returnAmount, compoundRate, farmInfo.dex, {
        provideAmount,
        returnAmount,
        price,
        via
      }, farmInfo.farmType);
      zapSingleAsset = result.desc;
    }

    // Bond with ${dex} LP
    if (sendExecuteMsg?.msg['bond'] && this.info.farmInfos.find(o => o.farmContract === sendExecuteMsg?.contract)) {
      const bondMsg = sendExecuteMsg.msg['bond'];
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === sendExecuteMsg.contract);
      const farm = farmInfo?.farm;
      const amount = +sendExecuteMsg.amount / CONFIG.UNIT || 0;
      const compoundRate = +bondMsg.compound_rate;
      const baseTokenSymbol = this.getSymbol(bondMsg.asset_token);
      const denomTokenSymbol = this.getSymbol(farmInfo.denomTokenContract);

      const depositMsg = msgs[msgs.length - 3];
      const liquidInfo = farmInfo.pylonLiquidInfo;
      if (depositMsg?.contract === liquidInfo?.dpPool && depositMsg?.execute_msg?.['deposit']) {
        const provideAmount = +depositMsg.coins.find(it => it.denom === Denom.USD)?.amount / CONFIG.UNIT || 0;
        const via = 'Pylon pool';
        const result = txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, amount, compoundRate, farmInfo.dex, {
          provideAmount,
          via
        }, farmInfo.farmType);
        if (zapSingleAsset) {
          return {desc: zapSingleAsset + '<br>' + result.desc, action: 'Farm'};
        } else {
          return result;
        }
      }
      return txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, amount, compoundRate, farmInfo.dex, null, farmInfo.farmType);
    } else if (zapSingleAsset) {
      return {desc: zapSingleAsset, action: 'Farm'};
    }

    // Bond with Token(s)
    if (lastMsg.execute_msg['bond'] && this.info.farmInfos.find(o => o.farmContract === lastMsg.execute_msg['bond'].contract)) {
      const bondMsg = lastMsg.execute_msg['bond'];
      const lpAmount = +lastContractEvent?.attributes.find(o => o.key === 'share')?.value / CONFIG.UNIT || 0;
      const taxAmount = +lastContractEvent?.attributes.find(o => o.key === 'tax_amount')?.value || 0;
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === bondMsg.contract);
      const farm = farmInfo.farm;
      const compoundRate = +bondMsg.compound_rate;

      const baseTokenSymbol = bondMsg.assets[0].info?.token ? this.getSymbol(bondMsg.assets[0].info?.token?.['contract_addr']) : this.getSymbol(bondMsg.assets[0].info?.native_token?.['denom']);
      let baseTokenAmount: number;
      if (bondMsg.assets[0].info?.native_token?.['denom']) {
        baseTokenAmount = (+bondMsg.assets[0].amount - +taxAmount) / CONFIG.UNIT;
      } else {
        baseTokenAmount = +bondMsg.assets[0].amount / this.info.tokenInfos[bondMsg.assets[0].info?.token?.['contract_addr']].unit;
      }

      const denomTokenSymbol = bondMsg.assets[1].info?.token ? this.getSymbol(bondMsg.assets[1].info?.token?.['contract_addr']) : this.getSymbol(bondMsg.assets[1].info?.native_token?.['denom']);
      let denomTokenAmount: number;
      if (bondMsg.assets[1].info?.native_token?.['denom']) {
        denomTokenAmount = (+bondMsg.assets[1].amount - +taxAmount) / CONFIG.UNIT;
      } else {
        denomTokenAmount = +bondMsg.assets[1].amount / this.info.tokenInfos[bondMsg.assets[1].info?.token?.['contract_addr']].unit;
      }

      return txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, lpAmount, compoundRate, farmInfo.dex, {
        baseTokenAmount,
        denomTokenAmount
      }, 'LP');
    }

    // Bond with UST
    if (lastMsg.execute_msg['zap_to_bond'] && [this.terrajs.settings.staker, this.terrajs.settings.stakerAstroport, 'terra10u9342cdwwqpe4wz9mf2c00ytlcr847wpe0xh4', 'terra1hcerg7unfkyh3ekvjrx36d3cujnkd9v2mxejdl', 'terra1mwnu40j5q8c42kv59kqx0u2peyku94564wwhvd'].includes(lastMsg.contract)) {
      const zapToBondMsg = lastMsg.execute_msg['zap_to_bond'];

      const provideAmount = +lastContractEvent?.attributes.find(o => o.key === 'provide_amount')?.value / CONFIG.UNIT || 0;
      const offerAmount = +lastContractEvent?.attributes.find(o => o.key === 'offer_amount')?.value / CONFIG.UNIT || 0;
      const returnAmount = +lastContractEvent?.attributes.find(o => o.key === 'return_amount')?.value / (zapToBondMsg.pair_asset.token ? this.info.tokenInfos[zapToBondMsg.pair_asset.token.contract_addr]?.unit : CONFIG.UNIT);
      const lpAmount = +lastContractEvent?.attributes.find(o => o.key === 'share')?.value / CONFIG.UNIT || 0;
      const price = roundSixDecimal(offerAmount / returnAmount);
      const compoundRate = +zapToBondMsg.compound_rate;
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === zapToBondMsg.contract);
      const farm = farmInfo?.farm;

      const pair_asset_b_token_contract_addr = zapToBondMsg.pair_asset_b?.token?.contract_addr;
      if (pair_asset_b_token_contract_addr) {
        const baseTokenSymbol = this.getSymbol(pair_asset_b_token_contract_addr);
        const denomTokenSymbol = zapToBondMsg.pair_asset.token ? this.getSymbol(zapToBondMsg.pair_asset.token.contract_addr) : this.getSymbol(zapToBondMsg.pair_asset.native_token.denom);
        const denomTokenAskAssetIndex = lastContractEvent?.attributes.findIndex(o => o.key === 'ask_asset' && o.value === pair_asset_b_token_contract_addr);
        const denomTokenOfferAmountKeyIndex = lastContractEvent?.attributes[+denomTokenAskAssetIndex + 1];
        const denomTokenReturnAmountKeyIndex = lastContractEvent?.attributes[+denomTokenAskAssetIndex + 2];
        const denomTokenOfferAmount = denomTokenOfferAmountKeyIndex.key === 'offer_amount' ? +denomTokenOfferAmountKeyIndex.value / this.getUnit(zapToBondMsg.pair_asset.token.contract_addr) || 0 : null;
        const denomReturnAmountDenom = denomTokenReturnAmountKeyIndex.key === 'return_amount' ? +denomTokenReturnAmountKeyIndex.value / this.getUnit(pair_asset_b_token_contract_addr) || 0 : null;
        const priceDenom = roundSixDecimal(denomTokenOfferAmount / denomReturnAmountDenom);
        return txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, lpAmount, compoundRate, farmInfo?.dex, {
          provideAmount,
          returnAmount,
          price,
          returnAmountB: denomReturnAmountDenom,
          priceB: priceDenom
        }, 'LP');
      } else {
        const baseTokenSymbol = zapToBondMsg.pair_asset.token ? this.getSymbol(zapToBondMsg.pair_asset.token.contract_addr) : this.getSymbol(zapToBondMsg.pair_asset.native_token.denom);
        const denomTokenSymbol = 'UST';
        return txHistoryFactory.depositFarm(farm, baseTokenSymbol, denomTokenSymbol, lpAmount, compoundRate, farmInfo?.dex, {
          provideAmount,
          returnAmount,
          price
        }, 'LP');
      }
    }

    // Bond native
    if (lastMsg.execute_msg['bond_native'] && this.info.farmInfos.find(o => o.farmContract === msgs[0].contract)) {
      const coin = lastMsg.coins[0];
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === msgs[0].contract);
      const farm = farmInfo?.farm;
      const amount = +coin.amount / CONFIG.UNIT || 0;
      const baseTokenSymbol = this.getSymbol(coin.denom);

      return txHistoryFactory.depositFarm(farm, baseTokenSymbol, '', amount, 1, farmInfo.dex, null, farmInfo.farmType);
    }

    // Unbond as ${dex} LP (and swap)
    if (msgs[0]?.execute_msg['unbond'] &&
      this.info.farmInfos.find(o => o.farmContract === msgs[0].contract) &&
      !(sendExecuteMsg?.msg['withdraw_liquidity'] || sendExecuteMsg?.msg['zap_to_unbond'])
    ) {
      const unbondMsg = msgs[0].execute_msg['unbond'];

      let amount: number;
      let baseTokenSymbol: string;
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === msgs[0].contract);
      const farm = farmInfo?.farm;
      const denomTokenSymbol = this.getSymbol(farmInfo?.denomTokenContract);
      if (farmInfo.farmType === 'BORROWED') {
        const logLines = lastContractEvent.attributes.reverse();
        const askAsset = logLines.find(o => o.key === 'ask_asset')?.value;
        const offerAmount = logLines.find(o => o.key === 'offer_amount')?.value;
        const returnAmount = logLines.find(o => o.key === 'return_amount')?.value;
        const withdrawA = logLines.find(o => o.key === 'withdraw_a_amount')?.value;
        const withdrawB = logLines.find(o => o.key === 'withdraw_b_amount')?.value;
        amount = +plus(returnAmount, offerAmount === withdrawA ? withdrawB : withdrawA) / CONFIG.UNIT || 0;
        baseTokenSymbol = this.getSymbol(farmInfo.defaultBaseTokenContract);
      } else {
        amount = +unbondMsg.amount / CONFIG.UNIT;
        baseTokenSymbol = this.getSymbol(unbondMsg.asset_token);
      }

      if (!sendExecuteMsg?.msg['execute_swap_operations']) {
        return txHistoryFactory.withdrawFarm(farm, baseTokenSymbol, denomTokenSymbol, amount, false, farmInfo.dex, null, farmInfo.farmType);
      }

      const totalAmount = +lastContractEvent.attributes.reverse().find(o => o.key === 'return_amount')?.value / CONFIG.UNIT || 0;

      return txHistoryFactory.withdrawFarm(farm, baseTokenSymbol, denomTokenSymbol, amount, true, farmInfo.dex, {tokenAAmount: totalAmount}, farmInfo.farmType);
    }

    // Unbond as token+UST & Unbond as UST
    if (
      (sendExecuteMsg?.msg['withdraw_liquidity'] || sendExecuteMsg?.msg['zap_to_unbond']) &&
      this.info.farmInfos.find(o => o.farmContract === secondLastMsg?.contract)
    ) {
      const unbondMsg = secondLastMsg.execute_msg['unbond'];
      const withdrawLiquidityMsg = sendExecuteMsg.msg['withdraw_liquidity'];

      const lpAmount = +sendExecuteMsg.amount / CONFIG.UNIT;
      const tokenSymbol = this.getSymbol(unbondMsg.asset_token);
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === secondLastMsg.contract);
      const refundAssets = lastContractEvent.attributes.find(o => o.key === 'refund_assets')?.value.split(',');
      const [uusdAmountRaw, tokenAmountRaw] = (refundAssets[0].match(alphabetRegExp)[0] === 'uusd' ? refundAssets : [refundAssets[1], refundAssets[0]])
        .map(value => +value.match(numberRegExp)[0] || 0);
      const uusdAmount = uusdAmountRaw / CONFIG.UNIT;
      const tokenAmount = tokenAmountRaw / this.info.tokenInfos[unbondMsg.asset_token]?.unit ?? CONFIG.UNIT;
      const farm = farmInfo?.farm;
      const denomTokenSymbol = this.getSymbol(farmInfo?.denomTokenContract);
      if (withdrawLiquidityMsg) {
        return txHistoryFactory.withdrawFarm(farm, tokenSymbol, denomTokenSymbol, lpAmount, false, farmInfo.dex, {
          tokenAAmount: uusdAmount,
          tokenBAmount: tokenAmount
        });
      }

      const zap_to_unbond = ensureBase64toObject(sendExecuteMsg?.msg['zap_to_unbond']);
      if (zap_to_unbond['sell_asset_b']) {
        const uusdAskAssetIndex = lastContractEvent?.attributes.findIndex(o => o.key === 'ask_asset' && o.value === Denom.USD);
        const uusdReturnAmountKeyIndex = lastContractEvent?.attributes[+uusdAskAssetIndex + 2];
        const uusdReturnAmount = uusdReturnAmountKeyIndex.key === 'return_amount' ? +uusdReturnAmountKeyIndex.value / CONFIG.UNIT || 0 : null;

        return txHistoryFactory.withdrawFarm(farm, tokenSymbol, denomTokenSymbol, lpAmount, true, farmInfo.dex, {tokenAAmount: uusdReturnAmount});

      } else {
        const swappedAmount = +lastContractEvent.attributes.find(o => o.key === 'return_amount')?.value / CONFIG.UNIT || 0;
        const totalAmount = +plus(uusdAmount, swappedAmount);

        return txHistoryFactory.withdrawFarm(farm, tokenSymbol, denomTokenSymbol, lpAmount, true, farmInfo.dex, {tokenAAmount: totalAmount});
      }
    }

    // Update Bond
    if (lastMsg.execute_msg['update_bond'] && this.info.farmInfos.find(o => o.farmContract === lastMsg.contract)) {
      const updateBondMsg = lastMsg.execute_msg['update_bond'];

      const baseSymbol = this.getSymbol(updateBondMsg.asset_token);

      const totalLP = +updateBondMsg.amount_to_auto + +updateBondMsg.amount_to_stake;
      const rawAmountToAuto = updateBondMsg.amount_to_auto;
      const rawAmountToStake = updateBondMsg.amount_to_stake;
      const amountToAuto = +rawAmountToAuto / CONFIG.UNIT;
      const amountToStake = +rawAmountToStake / CONFIG.UNIT;
      const amountToAutoPercentage = this.percentPipe.transform(div(rawAmountToAuto, totalLP));
      const amountToStakePercentage = this.percentPipe.transform(div(rawAmountToStake, totalLP));
      const farmInfo = this.info.farmInfos.find(o => o.farmContract === lastMsg.contract);
      const denomSymbol = this.getSymbol(farmInfo?.denomTokenContract);

      let assetDesc = '';
      let unit = '';
      if (FARM_TYPE_DEPOSIT_WITH_SINGLE_CW20TOKEN.has(farmInfo.farmType)) {
        assetDesc = `${baseSymbol}`;
        unit = `${baseSymbol}`;
      } else {
        assetDesc = `${baseSymbol}-${denomSymbol} ${farmInfo.dex} LP`;
        unit = 'LP';
      }
      return {
        action: 'Farm',
        desc: `Reallocated deposited ${assetDesc} to auto-compound ${amountToAutoPercentage}, auto-stake ${amountToStakePercentage} (${amountToAuto} ${unit}, ${amountToStake} ${unit}) `,
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

  getUnit(contract: string) {
    return this.info.tokenInfos[contract]?.unit || CONFIG.UNIT;
  }
}
