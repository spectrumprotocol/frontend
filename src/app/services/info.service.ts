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

export interface Stat {
  pairs: Record<string, PairStat>;
  vaultFee: number;
  tvl: string;
  govStaked: string;
  govTvl: string;
  govApr: number;
}

const HEIGHT_PER_YEAR = 365 * 24 * 60 * 60 * 1000 / BLOCK_TIME;

@Injectable({
  providedIn: 'root'
})
export class InfoService {
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

  constructor(
    private bankService: BankService,
    @Inject(FARM_INFO_SERVICE) private farmInfos: FarmInfoService[],
    private gov: GovService,
    private terrajs: TerrajsService,
    private terraSwap: TerraSwapService,
    private terraSwapFactory: TerraSwapFactoryService,
    private token: TokenService,
    private specFarm: SpecFarmService,
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
        poolInfos[pool.asset_token] = Object.assign(pool, { farm: farmInfo.farmName });
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
      const pairStats = await farmInfo.queryPairStats(farmPoolInfos, this.pairInfos);
      Object.assign(stat.pairs, pairStats);
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

}
