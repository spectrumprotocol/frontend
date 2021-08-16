import { Inject, Injectable } from '@angular/core';
import { BLOCK_TIME, TerrajsService } from './terrajs.service';
import { TokenService } from './api/token.service';
import { BankService } from './api/bank.service';
import { TerraSwapService } from './api/terraswap.service';
import { PoolResponse } from './api/terraswap_pair/pool_response';
import { div, plus, times } from '../libs/math';
import { CONFIG } from '../consts/config';
import { Denom } from '@terra-money/terra.js';
import { TerraSwapFactoryService } from './api/terraswap-factory.service';
import { GovService } from './api/gov.service';
import { FarmInfoService, FARM_INFO_SERVICE, PairStat, PoolInfo, RewardInfoResponseItem } from './farm_info/farm-info.service';
import { fromEntries } from '../libs/core';
import { PairInfo } from './api/terraswap_factory/pair_info';
import { SpecFarmService } from './api/spec-farm.service';
import { ConfigInfo as SpecFarmConfigInfo } from './api/spec_farm/config_info';
import {CalcService} from './calc.service';
import {BalancePipe} from '../pipes/balance.pipe';
import {LpBalancePipe} from '../pipes/lp-balance.pipe';
import {Vault} from '../pages/vault/vault.component';
import {HttpClient} from '@angular/common/http';

export interface Stat {
  pairs: Record<string, PairStat>;
  vaultFee: number;
  tvl: string;
  govStaked: string;
  govTvl: string;
  govApr: number;
}

interface TxHistory {
  desc: string;
  txhash: string;
  timestamp: Date;
  action: 'Farm'|'Trade'|'Gov';
  id: number;
}

type PendingReward = {
  pending_reward_token: number;
  pending_reward_ust: number;
};

type PendingRewardByFarmToken = {
  [key: string]: PendingReward;
};

export interface ChartData {
  name: string;
  value: number;
}

const HEIGHT_PER_YEAR = 365 * 24 * 60 * 60 * 1000 / BLOCK_TIME;

@Injectable({
  providedIn: 'root'
})
export class InfoService {

  constructor(
    private bankService: BankService,
    @Inject(FARM_INFO_SERVICE) public farmInfos: FarmInfoService[],
    private gov: GovService,
    private terrajs: TerrajsService,
    private terraSwap: TerraSwapService,
    private terraSwapFactory: TerraSwapFactoryService,
    private token: TokenService,
    private specFarm: SpecFarmService,
    private calcService: CalcService,
    private balancePipe: BalancePipe,
    private lpBalancePipe: LpBalancePipe,
    private httpClient: HttpClient
  ) {
    try {
      const poolJson = localStorage.getItem('poolInfos');
      if (poolJson) {
        this.poolInfos = JSON.parse(poolJson);
      }
      const pairJson = localStorage.getItem('pairInfos');
      if (pairJson) {
        this.pairInfos = JSON.parse(pairJson);
      }
      const coinJson = localStorage.getItem('coinInfos');
      if (coinJson) {
        this.coinInfos = JSON.parse(coinJson);
      }
      const statJson = localStorage.getItem('stat');
      if (statJson) {
        this.stat = JSON.parse(statJson);
      }
    } catch (e) { }
  }
  userUstAmount: string;
  userSpecAmount: string;
  userSpecLpAmount: string;

  specPoolInfo: PoolResponse;
  specPrice: string;

  private poolInfoNetwork: string;
  poolInfos: Record<string, PoolInfo>;
  pairInfos: Record<string, PairInfo> = {};
  coinInfos: Record<string, string> = {};

  stat: Stat;

  rewardInfos: Record<string, RewardInfoResponseItem> = {};
  tokenBalances: Record<string, string> = {};
  poolResponses: Record<string, PoolResponse> = {};

  specFarmConfig: SpecFarmConfigInfo;

  public currentTxOffset = 0;
  offsetTxLimit = 20;
  txHistoryList: TxHistory[] = [];
  previousTxHistoryLength = 0;

  cw20tokensWhitelist: any;

  myTvl = 0;
  allVaults: Vault[];

  chartDataList: ChartData[];

  pendingRewardByFarmToken: PendingRewardByFarmToken = {
    ['GOV_SPEC']: { pending_reward_token: 0, pending_reward_ust: 0},
    ['SPEC']: { pending_reward_token: 0, pending_reward_ust: 0},
    ['MIR']: { pending_reward_token: 0, pending_reward_ust: 0},
    ['ANC']: { pending_reward_token: 0, pending_reward_ust: 0},
    ['MINE']: { pending_reward_token: 0, pending_reward_ust: 0}
  };

  bondAmountUstByFarm: Record<string, number> = {
    SPEC: 0,
    MIR: 0,
    ANC: 0,
    MINE: 0
  };

  async refreshBalance(opt: { spec?: boolean; ust?: boolean; lp?: boolean }) {
    if (!this.terrajs.isConnected) {
      return;
    }
    const tasks: Promise<any>[] = [];
    if (opt.spec) {
      const task = this.token.balance(this.terrajs.settings.specToken)
        .then(it => this.userSpecAmount = div(it.balance, CONFIG.UNIT));
      tasks.push(task);
    }
    if (opt.lp) {
      const task = this.token.balance(this.terrajs.settings.specLpToken)
        .then(it => this.userSpecLpAmount = div(it.balance, CONFIG.UNIT));
      tasks.push(task);
    }
    if (opt.ust) {
      const task = this.bankService.balances()
        .then(it => this.userUstAmount = div(it.get(Denom.USD)?.amount.toNumber() ?? 0, CONFIG.UNIT));
      tasks.push(task);
    }
  }

  async refreshPool() {
    this.specPoolInfo = await this.terraSwap.query(this.terrajs.settings.specPool, { pool: {} });
    this.specPrice = div(this.specPoolInfo.assets[1].amount, this.specPoolInfo.assets[0].amount);
  }

  async ensurePoolInfoLoaded() {
    if (this.poolInfos && this.poolInfoNetwork === this.terrajs.settings.chainID) {
      return this.poolInfos;
    }
    await this.refreshPoolInfos();
    this.poolInfoNetwork = this.terrajs.settings.chainID;
  }

  async refreshPoolInfos() {
    const poolInfos: Record<string, PoolInfo> = {};
    const tasks = this.farmInfos.map(async farmInfo => {
      const pools = await farmInfo.queryPoolItems();
      for (const pool of pools) {
        poolInfos[pool.asset_token] = Object.assign(pool, { farm: farmInfo.farmName, token_symbol: farmInfo.tokenSymbol });
      }
    });
    await Promise.all(tasks);

    localStorage.setItem('poolInfos', JSON.stringify(poolInfos));
    this.poolInfos = poolInfos;
  }

  async ensurePairInfos() {
    await this.ensurePoolInfoLoaded();
    const tasks = Object.keys(this.poolInfos)
      .filter(key => !this.pairInfos[key])
      .map(async key => {
        const it = await this.terraSwapFactory.query({
          pair: {
            asset_infos: [
              { token: { contract_addr: key } },
              { native_token: { denom: 'uusd' } }
            ]
          }
        });
        this.pairInfos[key] = it;
      });
    if (tasks.length) {
      await Promise.all(tasks);
      localStorage.setItem('pairInfos', JSON.stringify(this.pairInfos));
    }
  }

  async ensureCoinInfos() {
    await this.ensurePoolInfoLoaded();
    const tasks = Object.keys(this.poolInfos)
      .filter(key => !this.coinInfos[key])
      .map(async key => {
        const it = await this.token.query(key, { token_info: {} });
        this.coinInfos[key] = it.symbol;
      });
    if (tasks.length) {
      await Promise.all(tasks);
      localStorage.setItem('coinInfos', JSON.stringify(this.coinInfos));
    }
  }

  async refreshStat() {
    const stat: Stat = {
      pairs: {},
      vaultFee: 0,
      tvl: '0',
      govStaked: '0',
      govTvl: '0',
      govApr: 0,
    };
    await this.refreshPoolInfos();
    await this.ensurePairInfos();
    const tasks = this.farmInfos.map(async farmInfo => {
      const farmPoolInfos = fromEntries(Object.entries(this.poolInfos)
        .filter(it => it[1].farm === farmInfo.farmName));
      try {
        const pairStats = await farmInfo.queryPairStats(farmPoolInfos, this.pairInfos);
        Object.assign(stat.pairs, pairStats);
      } catch (e) {
        if (!this.stat) {
          throw e;
        }
        Object.assign(stat.pairs, this.stat.pairs);
      }
    });
    await Promise.all([
      this.refreshGovStat(stat),
      ...tasks
    ]);

    const config = await this.gov.config();
    const totalWeight = Object.keys(stat.pairs)
      .map(key => stat.pairs[key].multiplier)
      .reduce((a, b) => a + b, 0);
    const height = await this.terrajs.getHeight();
    const specPerHeight = config.mint_end > height ? config.mint_per_block : '0';
    const ustPerYear = +specPerHeight * HEIGHT_PER_YEAR * +this.specPrice;
    for (const pair of Object.values(stat.pairs)) {
      pair.specApr = ustPerYear * pair.multiplier / totalWeight / +pair.tvl;
      stat.vaultFee += pair.vaultFee;
      stat.tvl = plus(stat.tvl, pair.tvl);
    }
    stat.govApr = stat.vaultFee / +stat.govTvl;
    this.stat = stat;
    localStorage.setItem('stat', JSON.stringify(stat));
  }

  private async refreshGovStat(stat: Stat) {
    const poolTask = this.refreshPool();

    const height = await this.terrajs.getHeight();
    const state = await this.gov.query({ state: { height } });
    stat.govStaked = state.total_staked;

    await poolTask;
    stat.govTvl = times(stat.govStaked, this.specPrice);
    stat.tvl = plus(stat.tvl, stat.govTvl);
  }

  async refreshRewardInfos() {
    const rewardInfos: Record<string, RewardInfoResponseItem> = {};
    const tasks = this.farmInfos.map(async farmInfo => {
      const rewards = await farmInfo.queryRewards();
      for (const reward of rewards) {
        rewardInfos[reward.asset_token] = reward;
      }
    });
    await Promise.all(tasks);
    this.rewardInfos = rewardInfos;
  }

  async refreshPoolInfo(assetToken?: string) {
    if (assetToken) {
      const pairInfo = this.pairInfos[assetToken];
      const tasks: Promise<any>[] = [];
      tasks.push(this.token.balance(assetToken)
        .then(it => this.tokenBalances[assetToken] = it.balance));
      tasks.push(this.terraSwap.query(pairInfo.contract_addr, { pool: {} })
        .then(it => this.poolResponses[assetToken] = it));
      await Promise.all(tasks);
    } else {
      await this.ensurePairInfos();
      const tokenBalances: Record<string, string> = {};
      const poolResponses: Record<string, PoolResponse> = {};
      const vaultsTasks = Object.keys(this.poolInfos)
        .map(async key => {
          const pairInfo = this.pairInfos[key];
          const tasks: Promise<any>[] = [];
          tasks.push(this.token.balance(key)
            .then(it => tokenBalances[key] = it.balance));
          tasks.push(this.terraSwap.query(pairInfo.contract_addr, { pool: {} })
            .then(it => poolResponses[key] = it));
          await Promise.all(tasks);
        });
      await Promise.all(vaultsTasks);
      this.tokenBalances = tokenBalances;
      this.poolResponses = poolResponses;
    }
  }

  async refreshLock() {
    this.specFarmConfig = await this.specFarm.query({ config: {} });
  }

  async ensureCw20tokensWhitelist(){
    if(!this.cw20tokensWhitelist){
      this.cw20tokensWhitelist = await this.httpClient.get<object>('https://assets.terra.money/cw20/tokens.json').toPromise();
    }
  }

  async populateTxHistory(){
    if (this.currentTxOffset === undefined){
      return; // end of pagination txsRes.next is undefined
    }
    const queryParams: Record<string, string> = {
      offset: this.currentTxOffset.toString(),
      limit: this.offsetTxLimit.toString(),
      account: this.terrajs.address,
      chainId: this.terrajs.network.chainID
    };
    const txsRes = await this.terrajs.getFCD('v1/txs', queryParams);
    for (const item of txsRes.txs){
      const txHistory = await this.processTxItem(item);
      if (txHistory){
        this.txHistoryList.push(txHistory);
      }
    }
    this.currentTxOffset = txsRes.next;
    if (this.previousTxHistoryLength === this.txHistoryList.length){
      await this.populateTxHistory();
    } else{
      this.previousTxHistoryLength = this.txHistoryList.length;
    }
  }

  async postTxItem(txhash: string){
    // because FCD query http200 is not immediate
    setTimeout(async () => {
      const txRes = await this.terrajs.getFCD(`v1/tx/${txhash}`);
      const txHistory = await this.processTxItem(txRes);
      this.txHistoryList = [txHistory, ...this.txHistoryList];
    }, 3000);
  }

  async processTxItem(item: any): Promise<TxHistory>{
    if (item.tx?.value?.msg){
      const lastIndex = (item.tx.value.msg as []).length - 1;
      if (item.tx.value.msg[lastIndex]?.type === 'wasm/MsgExecuteContract'){
        const lastExecuteMsg = JSON.parse(atob(item.tx.value.msg[lastIndex]?.value?.execute_msg));
        if (lastExecuteMsg.swap && item.tx.value.msg[lastIndex]?.value?.contract === this.terrajs.settings.specPool){
          const ustOffer = +item.tx.value.msg[lastIndex]?.value?.coins[0].amount / CONFIG.UNIT;
          const return_amount = +item.logs[lastIndex].events.find(o => o.type === 'from_contract').attributes.find(o => o.key === 'return_amount').value / CONFIG.UNIT;
          const price = this.calcService.roundSixDecimal((ustOffer / return_amount).toString());
          return {
            desc: `Bought ${return_amount} SPEC for ${ustOffer} UST at price ${price} UST`,
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Trade',
            id: item.id
          };
        }
        else if (lastExecuteMsg.send?.msg && JSON.parse(atob(lastExecuteMsg.send?.msg))?.execute_swap_operations?.operations[1]?.terra_swap?.ask_asset_info?.token?.contract_addr === this.terrajs.settings.specToken)
        {
          const return_amount_list = item.logs[lastIndex].events?.find(o => o.type === 'from_contract')?.attributes?.filter(o => o.key === 'return_amount');
          const offer_amount = +(JSON.parse(atob(lastExecuteMsg.send?.msg))?.execute_swap_operations.offer_amount) / CONFIG.UNIT ?? 0;
          let offer_token;
          const offer_asset_info_token_contract = JSON.parse(atob(lastExecuteMsg.send?.msg))?.execute_swap_operations?.operations[0]?.terra_swap?.offer_asset_info?.token?.contract_addr;
          if (offer_asset_info_token_contract){
            await this.ensureCw20tokensWhitelist();
            offer_token = this.cw20tokensWhitelist[this.terrajs?.network?.name ?? 'mainnet'][offer_asset_info_token_contract]?.symbol;
          }
          const return_amount = return_amount_list[return_amount_list.length - 1]?.value / CONFIG.UNIT ?? 0;
          const price = this.calcService.roundSixDecimal((offer_amount / return_amount).toString());
          return {
            desc: `Bought ${return_amount} SPEC for ${offer_amount} ${offer_token} at price ${price} ${offer_token}`,
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Trade',
            id: item.id
          };
        }
        else if (lastExecuteMsg.execute_swap_operations?.operations[1].terra_swap?.ask_asset_info?.token?.contract_addr === this.terrajs.settings.specToken){
          const offer_denom = lastExecuteMsg.execute_swap_operations?.operations[0]?.native_swap?.offer_denom;
          const offer_amount = +lastExecuteMsg.execute_swap_operations.offer_amount / CONFIG.UNIT ?? 0;
          const return_amount_list = item.logs[lastIndex].events?.find(o => o.type === 'from_contract')?.attributes?.filter(o => o.key === 'return_amount');
          const return_amount = return_amount_list[return_amount_list.length - 1]?.value / CONFIG.UNIT ?? 0;
          const price = this.calcService.roundSixDecimal((offer_amount / return_amount).toString());
          return {
            desc: `Bought ${return_amount} SPEC for ${offer_amount} ${offer_denom} at price ${price} ${offer_denom}`,
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Trade',
            id: item.id
          };
        }
        else if (lastExecuteMsg.send?.msg && JSON.parse(atob(lastExecuteMsg.send?.msg))?.swap && item.tx.value.msg[lastIndex]?.value?.contract === this.terrajs.settings.specToken){
          const offer_amount = +item.logs[lastIndex].events?.find(o => o.type === 'from_contract')?.attributes?.find(o => o.key === 'offer_amount')?.value / CONFIG.UNIT ?? 0;
          const return_amount = +item.logs[lastIndex].events?.find(o => o.type === 'from_contract')?.attributes?.find(o => o.key === 'return_amount')?.value / CONFIG.UNIT ?? 0;
          const price = this.calcService.roundSixDecimal((return_amount / offer_amount).toString());
          return {
            desc: `Sold ${offer_amount} SPEC for ${return_amount} UST at price ${price} UST`,
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Trade',
            id: item.id
          };
        }
        else if (lastExecuteMsg.send?.msg && JSON.parse(atob(lastExecuteMsg.send?.msg))?.execute_swap_operations && item.tx.value.msg[lastIndex]?.value?.contract === this.terrajs.settings.specToken){
          const return_amount_list = item.logs[lastIndex].events?.find(o => o.type === 'from_contract')?.attributes?.filter(o => o.key === 'return_amount');
          const ask_asset_list = item.logs[lastIndex].events?.find(o => o.type === 'from_contract')?.attributes?.filter(o => o.key === 'ask_asset');
          const offer_amount = +item.logs[lastIndex].events?.find(o => o.type === 'from_contract')?.attributes?.find(o => o.key === 'offer_amount')?.value / CONFIG.UNIT ?? 0;
          let return_amount = +return_amount_list[return_amount_list.length - 1].value / CONFIG.UNIT ?? 0;
          await this.ensureCw20tokensWhitelist();
          let last_ask_asset = this.cw20tokensWhitelist[this.terrajs?.network?.name ?? 'mainnet'][ask_asset_list[ask_asset_list.length - 1].value]?.symbol;
          if (!last_ask_asset){
            const swap_coin = item.logs[lastIndex].events?.find(o => o.type === 'swap')?.attributes?.find(o => o.key === 'swap_coin');
            const numberRegExp = new RegExp('(\\d+)');
            const alphabetRegExp = new RegExp('[A-z]+');
            last_ask_asset = swap_coin.value.match(alphabetRegExp)[0];
            return_amount = +(swap_coin.value.match(numberRegExp)[0]) / CONFIG.UNIT ?? 0;
          }
          const price = this.calcService.roundSixDecimal((return_amount / offer_amount).toString());
          return {
            desc: `Sold ${offer_amount} SPEC for ${return_amount} ${last_ask_asset} at price ${price} ${last_ask_asset}`,
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Trade',
            id: item.id
          };
        }
        else if (lastExecuteMsg.withdraw && this.farmInfos.find(o => o.farmContract === item.tx.value.msg[lastIndex]?.value?.contract)) {
          let descAppend = '';
          for (let index = 0; index < item.tx.value.msg.length; index++){
            if (this.farmInfos.map(farmInfo => farmInfo.farmContract).includes(item.tx.value.msg[index].value?.contract)) {
              const execute_msg = JSON.parse(atob(item.tx.value.msg[index].value.execute_msg));
              const asset_token = this.coinInfos[execute_msg.withdraw.asset_token];
              let poolName = 'all pools';
              if (asset_token){
                poolName = asset_token + '-UST pool';
              }
              const foundFarmContract = this.farmInfos.find(o => o.farmContract === item.tx.value.msg[index].value?.contract);
              if (foundFarmContract.tokenSymbol !== 'SPEC'){
                const farm_amount = +item.logs[index].events?.find(o => o.type === 'from_contract')?.attributes?.find(o => o.key === 'farm_amount')?.value / CONFIG.UNIT ?? 0;
                const spec_amount = +item.logs[index].events?.find(o => o.type === 'from_contract')?.attributes?.find(o => o.key === 'spec_amount')?.value / CONFIG.UNIT ?? 0;
                descAppend = descAppend + `Unstaked rewards from ${foundFarmContract?.farmName} farm, ${poolName}, ${farm_amount} ${foundFarmContract.tokenSymbol}, ${spec_amount} SPEC <br>`;
              } else {
                const spec_amount = +item.logs[index].events?.find(o => o.type === 'from_contract')?.attributes?.find(o => o.key === 'amount')?.value / CONFIG.UNIT ?? 0;
                descAppend = descAppend + `Unstaked rewards from ${foundFarmContract?.farmName} farm, ${poolName}, ${spec_amount} SPEC <br>`;
              }
            }
          }

          return {
            desc: descAppend,
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Farm',
            id: item.id
          };
        }
        else if (lastExecuteMsg.bond){
          const lp = +item.logs[lastIndex].events?.find(o => o.type === 'from_contract')?.attributes?.find(o => o.key === 'share')?.value / CONFIG.UNIT ?? 0;
          const foundFarmContract = this.farmInfos.find(o => o.farmContract === lastExecuteMsg.bond.contract);
          let native_token_symbol = '';
          let native_token_amount = 0;
          let token_symbol = '';
          let token_amount = 0;
          if (lastExecuteMsg.bond?.assets){
            for (const asset of lastExecuteMsg.bond?.assets){
              if (asset.info?.native_token?.denom === 'uusd'){
                native_token_symbol = 'UST';
                native_token_amount = (+asset.amount) / CONFIG.UNIT;
              } else if (asset.info?.token){
                token_symbol = this.coinInfos[asset.info?.token.contract_addr];
                token_amount = (+asset.amount) / CONFIG.UNIT;
              }
            }
          }
          let autoCompoundDesc = '';
          if (lastExecuteMsg.bond.compound_rate === '1'){
            autoCompoundDesc = 'auto-compound mode';
          } else if (!lastExecuteMsg.bond.compound_rate || lastExecuteMsg.bond.compound_rate === '0' || lastExecuteMsg.bond.compound_rate === ''){
            autoCompoundDesc = 'auto-stake mode';
          } else if (+lastExecuteMsg.bond.compound_rate < 1 && +lastExecuteMsg.bond.compound_rate > 0){
            const compoundPercentage = +lastExecuteMsg.bond.compound_rate * 100;
            autoCompoundDesc = `auto-compound ${compoundPercentage}% mode`;
          }

          return {
            desc: `Deposited ${lp} ${token_symbol}-${native_token_symbol} LP (${token_amount} ${token_symbol}, ${native_token_amount} ${native_token_symbol} ${autoCompoundDesc}) to ${foundFarmContract?.farmName} farm`,
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Farm',
            id: item.id
          };
        }
        else if (this.farmInfos.find(o => o.farmContract === item.tx.value.msg[lastIndex - 1]?.value?.contract) && lastExecuteMsg.send?.msg === btoa('{"withdraw_liquidity":{}}')){
          const penultimateExecutionMsg = JSON.parse(atob(item.tx.value.msg[lastIndex - 1]?.value?.execute_msg));
          const symbol = this.coinInfos[penultimateExecutionMsg.unbond.asset_token];
          const foundFarmContract = this.farmInfos.find(o => o.farmContract === item.tx.value.msg[lastIndex - 1]?.value?.contract);
          const refund_assets = item.logs[lastIndex].events.find(o => o.type === 'from_contract').attributes.find(o => o.key === 'refund_assets');
          const numberRegExp = new RegExp('(\\d+)');
          const uusdAmount = refund_assets.value ? +(refund_assets.value.split(',')[0].match(numberRegExp)[0]) / CONFIG.UNIT : 0;
          const tokenAmount = refund_assets.value ? +(refund_assets.value.split(',')[1].match(numberRegExp)[0]) / CONFIG.UNIT : 0;
          return {
            desc: `Withdrawn ${(+lastExecuteMsg.send.amount / CONFIG.UNIT)} ${symbol}-UST LP (${tokenAmount} ${symbol}, ${uusdAmount} UST) from ${foundFarmContract?.farmName} farm`,
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Farm',
            id: item.id
          };
        }
        else if (lastExecuteMsg.send?.msg === btoa('{"stake_tokens":{}}') && lastExecuteMsg.send?.contract === this.terrajs.settings.gov){
          return {
            desc: 'Staked to Gov ' + (+lastExecuteMsg.send.amount / CONFIG.UNIT) + ' SPEC',
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Gov',
            id: item.id
          };
        }
        else if (lastExecuteMsg.poll_vote && item.tx.value.msg[lastIndex]?.value?.contract === this.terrajs.settings.platform){
          return {
            desc: 'Voted Poll ' + lastExecuteMsg.poll_vote.poll_id,
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Gov',
            id: item.id
          };
        }
        else if (lastExecuteMsg.poll_execute && item.tx.value.msg[lastIndex]?.value?.contract === this.terrajs.settings.platform){
          return {
            desc: 'Executed Poll ' + lastExecuteMsg.poll_execute.poll_id,
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Gov',
            id: item.id
          };
        }
        else if (lastExecuteMsg.withdraw && item.tx.value.msg[lastIndex]?.value?.contract === this.terrajs.settings.gov){
          const executeMsgLvl2 = JSON.parse(atob(item.tx.value.msg[lastIndex]?.value.execute_msg));
          return {
            desc: 'Unstaked from Gov ' + (+executeMsgLvl2.withdraw.amount / CONFIG.UNIT) + ' SPEC',
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Gov',
            id: item.id
          };
        }
        else if (lastExecuteMsg.send && JSON.parse(atob(JSON.parse(atob(item.tx.value.msg[lastIndex]?.value?.execute_msg)).send.msg)).poll_start && lastExecuteMsg.send?.contract === this.terrajs.settings.gov){
          const poll_start = JSON.parse(atob(JSON.parse(atob(item.tx.value.msg[lastIndex]?.value?.execute_msg)).send.msg)).poll_start;
          return {
            desc: 'Created Poll ' + poll_start.title,
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Gov',
            id: item.id
          };
        }
        else if (lastExecuteMsg.poll_end && item.tx.value.msg[lastIndex]?.value?.contract === this.terrajs.settings.platform){
          return {
            desc: 'Ended Poll ' + lastExecuteMsg.poll_end.poll_id,
            txhash: item.txhash,
            timestamp: new Date(item.timestamp),
            action: 'Gov',
            id: item.id
          };
        }
      }
    }
    return null;
  }

  async updateMyTvl() {
    const specPoolResponse = this.poolResponses[this.terrajs.settings.specToken];
    const mirPoolResponse = this.poolResponses[this.terrajs.settings.mirrorToken];
    const ancPoolResponse = this.poolResponses[this.terrajs.settings.anchorToken];
    const minePoolResponse = this.poolResponses[this.terrajs.settings.pylonToken];
    let tvl = 0;
    const pendingRewardByFarmToken: PendingRewardByFarmToken = {
      ['GOV_SPEC']: { pending_reward_token: 0, pending_reward_ust: 0},
      ['SPEC']: { pending_reward_token: 0, pending_reward_ust: 0},
      ['MIR']: { pending_reward_token: 0, pending_reward_ust: 0},
      ['ANC']: { pending_reward_token: 0, pending_reward_ust: 0},
      ['MINE']: { pending_reward_token: 0, pending_reward_ust: 0}
    };
    const bondAmountUstByFarm: Record<string, number> = {
      SPEC: 0,
      MIR: 0,
      ANC: 0,
      MINE: 0
    };

    for (const vault of this.allVaults) {
      const rewardInfo = this.rewardInfos[vault.assetToken];
      if (!rewardInfo) {
        continue;
      }
      const poolResponse = this.poolResponses[vault.assetToken];
      const bond_amount = +this.lpBalancePipe.transform(rewardInfo.bond_amount, poolResponse) / CONFIG.UNIT || 0;
      switch (this.poolInfos[vault.assetToken].farm){
        case 'Mirror': {
          bondAmountUstByFarm['MIR'] += bond_amount;
          break;
        }
        case 'Anchor': {
          bondAmountUstByFarm['ANC'] += bond_amount;
          break;
        }
        case 'Pylon': {
          bondAmountUstByFarm['MINE'] += bond_amount;
          break;
        }
        case 'Spectrum': {
          bondAmountUstByFarm['SPEC'] += bond_amount;
          break;
        }
        default: {
          break;
        }
      }

      tvl += bond_amount;
      const pending_reward_spec_ust = +this.balancePipe.transform(rewardInfo.pending_spec_reward, specPoolResponse) / CONFIG.UNIT || 0;
      tvl += pending_reward_spec_ust;
      pendingRewardByFarmToken['SPEC'].pending_reward_ust += pending_reward_spec_ust;
      pendingRewardByFarmToken['SPEC'].pending_reward_token += +rewardInfo.pending_spec_reward / CONFIG.UNIT;
      if (vault.poolInfo.farm === 'Mirror') {
        const pending_mir_reward_ust = +this.balancePipe.transform(rewardInfo.pending_farm_reward, mirPoolResponse) / CONFIG.UNIT || 0;
        tvl += pending_mir_reward_ust;
        pendingRewardByFarmToken['MIR'].pending_reward_ust += pending_mir_reward_ust;
        pendingRewardByFarmToken['MIR'].pending_reward_token += +rewardInfo.pending_farm_reward / CONFIG.UNIT;
      } else if (vault.poolInfo.farm === 'Anchor') {
        const pending_anc_reward_ust = +this.balancePipe.transform(rewardInfo.pending_farm_reward, ancPoolResponse) / CONFIG.UNIT || 0;
        tvl += pending_anc_reward_ust;
        pendingRewardByFarmToken['ANC'].pending_reward_ust += pending_anc_reward_ust;
        pendingRewardByFarmToken['ANC'].pending_reward_token += +rewardInfo.pending_farm_reward / CONFIG.UNIT;
      } else if (vault.poolInfo.farm === 'Pylon') {
        const pending_mine_reward_ust = +this.balancePipe.transform(rewardInfo.pending_farm_reward, minePoolResponse) / CONFIG.UNIT || 0;
        tvl += pending_mine_reward_ust;
        pendingRewardByFarmToken['MINE'].pending_reward_ust += pending_mine_reward_ust;
        pendingRewardByFarmToken['MINE'].pending_reward_token += +rewardInfo.pending_farm_reward / CONFIG.UNIT;
      }
    }

    const specGovStaked = this.terrajs.address ? (await this.gov.balance()).balance : 0;
    const gov_spec_staked_ust = +this.balancePipe.transform(specGovStaked, specPoolResponse) / CONFIG.UNIT || 0;
    pendingRewardByFarmToken['GOV_SPEC'].pending_reward_ust += gov_spec_staked_ust;
    pendingRewardByFarmToken['GOV_SPEC'].pending_reward_token += +specGovStaked / CONFIG.UNIT;
    tvl += gov_spec_staked_ust;
    this.myTvl = tvl;
    this.pendingRewardByFarmToken = pendingRewardByFarmToken;
    this.bondAmountUstByFarm = bondAmountUstByFarm;

  }


  async updateFarmInfoContractAddress() {
    this.farmInfos.map(farm => {
      switch (farm.tokenSymbol){
        case 'SPEC':
          farm.farmContract = this.terrajs.settings.specFarm;
          break;
        case 'MIR':
          farm.farmContract = this.terrajs.settings.mirrorFarm;
          break;
        case 'ANC':
          farm.farmContract = this.terrajs.settings.anchorFarm;
          break;
        case 'MINE':
          farm.farmContract = this.terrajs.settings.pylonFarm;
          break;
      }
    });
    await Promise.resolve();
  }

  async initializeVaultData(connected){
    this.updateVaults();

    const tasks: Promise<any>[] = [];
    tasks.push(this.ensureCoinInfos());
    tasks.push(this.refreshStat());
    tasks.push(this.refreshLock());
    if (connected) {
      tasks.push(this.refreshRewardInfos());
      tasks.push(this.refreshPoolInfo());
    }

    await Promise.all(tasks);
    this.updateVaults();
    await this.updateMyTvl();
  }

  updateVaults() {
    const token = this.terrajs.settings.specToken;
    if (!this.coinInfos?.[token]) {
      return;
    }
    this.allVaults = [];
    for (const key of Object.keys(this.poolInfos)) {
      const pairStat = this.stat?.pairs[key];
      const poolApr = pairStat?.poolApr || 0;
      const poolApy = pairStat?.poolApy || 0;
      const specApr = pairStat?.specApr || 0;
      const govApr = this.stat?.govApr || 0;
      const specApy = specApr + specApr * govApr / 2;
      const compoundApy = poolApy + specApy;
      const farmApr = pairStat?.farmApr || 0;
      const farmApy = poolApr + poolApr * farmApr / 2;
      const stakeApy = farmApy + specApy;
      const apy = Math.max(compoundApy, stakeApy);

      const vault: Vault = {
        symbol: this.coinInfos[key],
        assetToken: key,
        pairStat,
        poolInfo: this.poolInfos[key],
        pairInfo: this.pairInfos[key],
        specApy,
        farmApy,
        compoundApy,
        stakeApy,
        apy,
      };
      this.allVaults.push(vault);
    }
  }
}
