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
import { BalancePipe } from '../pipes/balance.pipe';
import { LpBalancePipe } from '../pipes/lp-balance.pipe';
import { Vault } from '../pages/vault/vault.component';
import { HttpClient } from '@angular/common/http';

export interface Stat {
  pairs: Record<string, PairStat>;
  vaultFee: number;
  tvl: string;
  govStaked: string;
  govTvl: string;
  govApr: number;
}

type PendingReward = {
  pending_reward_token: number;
  pending_reward_ust: number;
};

type PortfolioItem = {
  bond_amount_ust: number;
};

export type Portfolio = {
  total_reward_ust: number;
  gov: PendingReward;
  tokens: Map<string, PendingReward>;
  farms: Map<string, PortfolioItem>;
};

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

  cw20tokensWhitelist: any;

  myTvl = 0;
  allVaults: Vault[];

  portfolio: Portfolio;

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
        poolInfos[pool.asset_token] = Object.assign(pool,
          {
            farm: farmInfo.farm,
            token_symbol: farmInfo.tokenSymbol,
            farmContract: farmInfo.farmContract,
            farmTokenContract: farmInfo.farmTokenContract,
          });
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
    await this.refreshPoolResponses();
    const tasks = this.farmInfos.map(async farmInfo => {
      const farmPoolInfos = fromEntries(Object.entries(this.poolInfos)
        .filter(it => it[1].farm === farmInfo.farm));
      try {
        const pairStats = await farmInfo.queryPairStats(farmPoolInfos, this.poolResponses);
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
        rewardInfos[reward.asset_token].farm = farmInfo.farm;
      }
    });
    await Promise.all(tasks);
    this.rewardInfos = rewardInfos;
  }

  async refreshPoolResponses(assetToken?: string) {
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
          if (this.terrajs.address) {
            tasks.push(this.token.balance(key)
              .then(it => tokenBalances[key] = it.balance));
          }
          tasks.push(this.terraSwap.query(pairInfo.contract_addr, { pool: {} })
            .then(it => poolResponses[key] = it));
          await Promise.all(tasks);
        });
      await Promise.all(vaultsTasks);
      this.tokenBalances = tokenBalances;
      this.poolResponses = poolResponses;
    }
  }

  async ensureCw20tokensWhitelist() {
    if (!this.cw20tokensWhitelist) {
      this.cw20tokensWhitelist = await this.httpClient.get<object>('https://assets.terra.money/cw20/tokens.json').toPromise();
    }
  }

  async updateMyTvl() {
    let tvl = 0;
    const portfolio: Portfolio = {
      total_reward_ust: 0,
      gov: { pending_reward_token: 0, pending_reward_ust: 0 },
      tokens: new Map(),
      farms: new Map(),
    };
    for (const farmInfo of this.farmInfos) {
      portfolio.tokens.set(farmInfo.tokenSymbol, { pending_reward_token: 0, pending_reward_ust: 0 });
      portfolio.farms.set(farmInfo.farm, { bond_amount_ust: 0 });
    }

    const specPoolResponse = this.poolResponses[this.terrajs.settings.specToken];
    for (const vault of this.allVaults) {
      const rewardInfo = this.rewardInfos[vault.assetToken];
      if (!rewardInfo) {
        continue;
      }
      const poolResponse = this.poolResponses[vault.assetToken];
      const bond_amount = +this.lpBalancePipe.transform(rewardInfo.bond_amount, poolResponse) / CONFIG.UNIT || 0;
      const farmInfo = this.farmInfos.find(it => it.farm === this.poolInfos[vault.assetToken].farm);
      portfolio.farms.get(farmInfo.farm).bond_amount_ust += bond_amount;

      tvl += bond_amount;
      const pending_reward_spec_ust = +this.balancePipe.transform(rewardInfo.pending_spec_reward, specPoolResponse) / CONFIG.UNIT || 0;
      tvl += pending_reward_spec_ust;
      portfolio.tokens.get('SPEC').pending_reward_ust += pending_reward_spec_ust;
      portfolio.tokens.get('SPEC').pending_reward_token += +rewardInfo.pending_spec_reward / CONFIG.UNIT;
      portfolio.total_reward_ust += pending_reward_spec_ust;
      if (vault.poolInfo.farm !== 'Spectrum') {
        const farmPoolResponse = this.poolResponses[farmInfo.farmTokenContract];
        const pending_farm_reward_ust = +this.balancePipe.transform(rewardInfo.pending_farm_reward, farmPoolResponse) / CONFIG.UNIT || 0;
        tvl += pending_farm_reward_ust;
        portfolio.tokens.get(farmInfo.tokenSymbol).pending_reward_ust += pending_farm_reward_ust;
        portfolio.tokens.get(farmInfo.tokenSymbol).pending_reward_token += +rewardInfo.pending_farm_reward / CONFIG.UNIT;
        portfolio.total_reward_ust += pending_farm_reward_ust;
      }
    }

    const specGovStaked = this.terrajs.address ? (await this.gov.balance()).balance : 0;
    const gov_spec_staked_ust = +this.balancePipe.transform(specGovStaked, specPoolResponse) / CONFIG.UNIT || 0;
    portfolio.gov.pending_reward_ust += gov_spec_staked_ust;
    portfolio.gov.pending_reward_token += +specGovStaked / CONFIG.UNIT;
    tvl += gov_spec_staked_ust;
    this.myTvl = tvl;
    this.portfolio = portfolio;
  }

  async initializeVaultData(connected: boolean) {
    const tasks: Promise<any>[] = [];
    tasks.push(this.ensureCoinInfos());
    tasks.push(this.refreshStat());
    if (connected) {
      tasks.push(this.refreshRewardInfos());
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
