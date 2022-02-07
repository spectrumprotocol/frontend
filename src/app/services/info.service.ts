import {Inject, Injectable} from '@angular/core';
import {BLOCK_TIME, TerrajsService} from './terrajs.service';
import {TokenService} from './api/token.service';
import {BankService} from './api/bank.service';
import {TerraSwapService} from './api/terraswap.service';
import {PoolResponse} from './api/terraswap_pair/pool_response';
import {div, minus, plus, times} from '../libs/math';
import {CONFIG} from '../consts/config';
import {TerraSwapFactoryService} from './api/terraswap-factory.service';
import {GovService} from './api/gov.service';
import {
  FARM_INFO_SERVICE,
  FarmInfoService,
  PairStat,
  PoolInfo,
  RewardInfoResponseItem
} from './farm_info/farm-info.service';
import {fromEntries} from '../libs/core';
import {PairInfo} from './api/terraswap_factory/pair_info';
import {BalancePipe} from '../pipes/balance.pipe';
import {LpBalancePipe} from '../pipes/lp-balance.pipe';
import {Vault} from '../pages/vault/vault.component';
import {HttpClient} from '@angular/common/http';
import {memoize} from 'utils-decorators';
import {Denom} from '../consts/denom';
import {WalletService} from './api/wallet.service';
import {AstroportService} from './api/astroport.service';
import {AstroportFactoryService} from './api/astroport-factory.service';
import {Apollo, gql} from 'apollo-angular';

export interface Stat {
  pairs: Record<string, PairStat>;
  vaultFee: number;
  tvl: string;
  govStaked: string;
  govTvl: string;
  govApr: number;
  govPoolCount: number;
}

export type PendingReward = {
  pending_reward_token: number;
  pending_reward_ust: number;
};

export type PortfolioItem = {
  bond_amount_ust: number;
};

export type Portfolio = {
  total_reward_ust: number;
  gov: PendingReward;
  avg_tokens_apr?: number;
  tokens: Map<string, PendingReward & { rewardTokenContract: string, apr?: number }>;
  farms: Map<string, PortfolioItem>;
};

export type TokenInfo = {
  name: string;
  symbol: string;
  decimals: number;
  unit: number;
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
    private astroport: AstroportService,
    private terraSwapFactory: TerraSwapFactoryService,
    private astroportFactory: AstroportFactoryService,
    private token: TokenService,
    private balancePipe: BalancePipe,
    private lpBalancePipe: LpBalancePipe,
    private httpClient: HttpClient,
    private wallet: WalletService,
    private apollo: Apollo
  ) {
    try {
      const infoSchemaVersion = localStorage.getItem('infoSchemaVersion');
      if (infoSchemaVersion && +infoSchemaVersion >= 2) {
        const poolJson = localStorage.getItem('poolInfos');
        if (poolJson) {
          this.poolInfos = JSON.parse(poolJson);
        }
        const pairJson = localStorage.getItem('pairInfos');
        if (pairJson) {
          this.pairInfos = JSON.parse(pairJson);
        }
        const statJson = localStorage.getItem('stat');
        if (statJson) {
          this.stat = JSON.parse(statJson);
        }
        const poolResponseJson = localStorage.getItem('poolResponses');
        if (poolResponseJson) {
          this.poolResponses = JSON.parse(poolResponseJson);
        }
        const rewardInfoJson = localStorage.getItem('rewardInfos');
        if (rewardInfoJson) {
          this.rewardInfos = JSON.parse(rewardInfoJson);
        }
        const tokenInfoJson = localStorage.getItem('tokenInfos');
        if (tokenInfoJson) {
          this.tokenInfos = JSON.parse(tokenInfoJson);
        }
      } else {
        localStorage.removeItem('poolInfos');
        localStorage.removeItem('pairInfos');
        localStorage.removeItem('stat');
        localStorage.removeItem('poolResponses');
        localStorage.removeItem('rewardInfos');
        localStorage.removeItem('tokenInfos');
      }
    } catch (e) { }
  }

  get ASTRO_KEY() {
    return `Astroport|${this.terrajs.settings.astroToken}|${Denom.USD}`;
  }
  userUstAmount: string;
  userSpecAmount: string;
  userSpecLpAmount: string;

  specPoolInfo: PoolResponse;
  specPrice: string;

  private loadedNetwork: string;
  poolInfos: Record<string, PoolInfo>;
  pairInfos: Record<string, PairInfo> = {};
  tokenInfos: Record<string, TokenInfo> = {};

  stat: Stat;
  circulation: string;
  marketCap: number;

  rewardInfos: Record<string, RewardInfoResponseItem & { farm: string, farmContract: string }> = {};
  tokenBalances: Record<string, string> = {};
  lpTokenBalances: Record<string, string> = {};
  poolResponses: Record<string, PoolResponse> = {};

  myTvl = 0;
  allVaults: Vault[] = [];

  portfolio: Portfolio;

  private DISABLED_VAULTS: Set<string> = new Set(['Terraswap|mAMC|UST', 'Terraswap|mGME|UST', 'Terraswap|VKR|UST', 'Terraswap|MIR|UST', 'Terraswap|ANC|UST', 'Terraswap|MINE|UST', 'Terraswap|ORION|UST', 'Terraswap|Psi|UST', 'Terraswap|nLuna|Psi', 'Terraswap|nETH|Psi']);
  private WILL_AVAILABLE_AT_ASTROPORT: Set<string> = new Set([]);
  private NOW_AVAILABLE_AT_ASTROPORT: Set<string> = new Set(['Terraswap|MIR|UST', 'Terraswap|ANC|UST', 'Terraswap|VKR|UST', 'Terraswap|ORION|UST', 'Terraswap|MINE|UST', 'Terraswap|Psi|UST', 'Terraswap|nLuna|Psi', 'Terraswap|nETH|Psi']);
  private PROXY_REWARD_NOT_YET_AVAILABLE: Set<string> = new Set([]);

  lastRefreshAstroportData: number;
  astroportData: any;

  shouldEnableFarmInfo(farmInfo: FarmInfoService) {
    if (this.terrajs.network?.name) {
      return this.terrajs.network?.name === 'mainnet' || !farmInfo.mainnetOnly;
    } else {
      return true;
    }
  }

  async refreshBalance(opt: { spec?: boolean; native_token?: boolean; lp?: boolean }) {
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
    if (opt.native_token) {
      tasks.push(this.refreshNativeTokens());
    }
  }

  @memoize(1000)
  async refreshNativeTokens() {
    const it = await this.bankService.balances();
    this.userUstAmount = div(it.get(Denom.USD)?.amount.toNumber() ?? 0, CONFIG.UNIT);
    for (const coin of it.toArray()) {
      this.tokenBalances[coin.denom] = coin.amount.toString() ?? '0';
    }
    if (!this.tokenBalances[Denom.LUNA]) {
      this.tokenBalances[Denom.LUNA] = '0';
    }
  }

  @memoize(1000)
  async refreshPool() {
    this.specPoolInfo = await this.terraSwap.query(this.terrajs.settings.specPool, { pool: {} });
    this.specPrice = div(this.specPoolInfo.assets[1].amount, this.specPoolInfo.assets[0].amount);
  }

  async ensurePoolInfoLoaded() {
    if (this.poolInfos && this.loadedNetwork === this.terrajs.settings.chainID) {
      return this.poolInfos;
    }
    await this.refreshPoolInfos();
    this.loadedNetwork = this.terrajs.settings.chainID;
  }

  @memoize(1000)
  async refreshPoolInfos() {
    const poolInfos: Record<string, PoolInfo> = {};
    const tasks = this.farmInfos.filter(farmInfo => this.shouldEnableFarmInfo(farmInfo)).map(async farmInfo => {
      if (!farmInfo.farmContract) {
        return;
      }
      const pools = await farmInfo.queryPoolItems();
      for (const pool of pools) {
        const key = `${farmInfo.dex}|${pool.asset_token}|${farmInfo.denomTokenContract}`;
        poolInfos[key] = Object.assign(pool,
          {
            key,
            farm: farmInfo.farm,
            farmContract: farmInfo.farmContract,
            baseTokenContract: pool.asset_token,
            denomTokenContract: farmInfo.denomTokenContract,
            rewardTokenContract: farmInfo.rewardTokenContract,
            rewardKey: `${farmInfo.dex}|${farmInfo.rewardTokenContract}|${Denom.USD}`,
            auto_compound: farmInfo.autoCompound,
            auto_stake: farmInfo.autoStake,
            govLock: farmInfo.govLock,
            forceDepositType: farmInfo.autoCompound === farmInfo.autoStake
              ? (farmInfo.govLock ? 'compound' : undefined)
              : (farmInfo.autoCompound ? 'compound' : 'stake'),
            auditWarning: farmInfo.auditWarning,
            farmType: farmInfo.farmType ?? 'LP',
            score: (farmInfo.highlight ? 1000000 : 0) + (pool.weight || 0),
            dex: farmInfo.dex ?? 'Terraswap',
            highlight: farmInfo.highlight,
            hasProxyReward: farmInfo.hasProxyReward ?? false,
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
        const baseTokenContract = this.poolInfos[key].baseTokenContract;
        const tokenA = baseTokenContract.startsWith('u') ?
          { native_token: { denom: baseTokenContract } } : { token: { contract_addr: baseTokenContract } };
        const denomTokenContract = this.poolInfos[key].denomTokenContract;
        const tokenB = denomTokenContract.startsWith('u') ?
          { native_token: { denom: denomTokenContract } } : { token: { contract_addr: denomTokenContract } };
        if (this.poolInfos[key].dex === 'Terraswap') {
          this.pairInfos[key] = await this.terraSwapFactory.query({
            pair: {
              asset_infos: [
                tokenA, tokenB
              ]
            }
          });
        } else if (this.poolInfos[key].dex === 'Astroport') {
          this.pairInfos[key] = await this.astroportFactory.query({
            pair: {
              asset_infos: [
                tokenA, tokenB
              ]
            }
          });
        }
      });

    if (tasks.length) {
      await Promise.all(tasks);
      localStorage.setItem('pairInfos', JSON.stringify(this.pairInfos));
    }
  }

  private cleanSymbol(symbol: string) {
    if (symbol.startsWith('wh')) {
      return symbol.substr(2);
    } else if (symbol === 'BLUNA') {
      return 'bLUNA';
    } else {
      return symbol;
    }
  }

  async ensureTokenInfos() {
    await this.ensurePoolInfoLoaded();
    const cw20Tokens = new Set<string>();
    Object.keys(this.poolInfos).forEach(key => {
      const baseTokenContract = this.poolInfos[key].baseTokenContract;
      const denomTokenContract = this.poolInfos[key].denomTokenContract;
      const rewardTokenContract = this.poolInfos[key].rewardTokenContract;
      if (baseTokenContract && !baseTokenContract.startsWith('u')) {
        cw20Tokens.add(baseTokenContract);
      }
      if (denomTokenContract && !denomTokenContract.startsWith('u')) {
        cw20Tokens.add(denomTokenContract);
      }
      if (rewardTokenContract && !rewardTokenContract.startsWith('u')) {
        cw20Tokens.add(rewardTokenContract);
      }
    });
    const tasks = Array.from(cw20Tokens)
      .filter(key => !this.tokenInfos[key])
      .map(async key => {
        const it = await this.token.query(key, { token_info: {} });
        this.tokenInfos[key] = {
          name: it.name,
          symbol: this.cleanSymbol(it.symbol),
          decimals: it.decimals,
          unit: 10 ** it.decimals,
        };
      });
    if (tasks.length) {
      await Promise.all(tasks);
      localStorage.setItem('tokenInfos', JSON.stringify(this.tokenInfos));
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
      govPoolCount: 1,
    };
    const vaultsTask = this.gov.vaults();
    await this.refreshPoolInfos();
    await this.refreshPoolResponses();
    await this.ensureAstroportData();

    const vaults = await vaultsTask;
    const tasks = this.farmInfos.filter(farmInfo => this.shouldEnableFarmInfo(farmInfo)).map(async farmInfo => {
      const farmPoolInfos = fromEntries(Object.entries(this.poolInfos)
        .filter(it => it[1].farmContract === farmInfo.farmContract));
      try {
        const pairStats = await farmInfo.queryPairStats(farmPoolInfos, this.poolResponses, vaults, this.pairInfos);
        const keys = Object.keys(pairStats);
        for (const key of keys){
          if (!pairStats[key].poolAstroApr) {
            pairStats[key].poolAstroApr = 0;
          }
          // if (farmInfo.dex === 'Astroport'){
          // if farmInfo.queryPairStats return poolApr 0 and poolAstroApr 0, meaning that do not use calculation on Spectrum side but use Astroport API
          if (farmInfo.dex === 'Astroport' && farmInfo.farmType === 'LP' && pairStats[key].poolApr === 0 && pairStats[key].poolAstroApr === 0){
            const found = this.astroportData.pools.find(pool => pool?.pool_address === this.pairInfos[key]?.contract_addr);
            // to prevent set pairStat undefined in case of no data available from Astroport api
            if (found){
              pairStats[key].poolApr = +found.protocol_rewards.apr;
              pairStats[key].poolAstroApr = +found.astro_rewards.apr;
              const proxyAndAstroApy = ((+found.protocol_rewards.apr + +found.astro_rewards.apr) / 8760 + 1) ** 8760 - 1;
              pairStats[key].poolApy = proxyAndAstroApy > 0 ? (proxyAndAstroApy + 1) * (+found.trading_fees.apy + 1) - 1 : 0;
              // pairStats[key].poolApy = ((+found.protocol_rewards.apr + +found.astro_rewards.apr) / 8760 + 1) ** 8760 - 1;
              // this.poolInfos[key].tradeApr = +found.trading_fees.apr;
            }
          }
          if (farmInfo.dex === 'Terraswap' && farmInfo.farmType === 'LP'){
              // supported only in backend
          }
        }

        Object.assign(stat.pairs, pairStats);
      } catch (e) {
        console.error('queryPairStats error >> ', e);
        if (!this.stat) {
          throw e;
        }
        for (const key of Object.keys(this.stat.pairs)) {
          if (!stat.pairs[key]) {
            stat.pairs[key] = this.stat.pairs[key];
          }
        }
      }
    });
    await Promise.all([
      this.refreshGovStat(stat),
      this.refreshMarketCap(),
      ...tasks
    ]);

    const config = await this.gov.config();
    const totalWeight = Object.keys(stat.pairs)
      .map(key => stat.pairs[key].multiplier)
      .reduce((a, b) => a + b, 0);
    const height = await this.terrajs.getHeight();
    const specPerHeight = config.mint_end > height ? config.mint_per_block : '0';
    const ustPerYear = +specPerHeight * HEIGHT_PER_YEAR * +this.specPrice
      * (1 - (+config.burnvault_ratio || 0))
      * (1 - +config.warchest_ratio);
    for (const pair of Object.values(stat.pairs)) {
      pair.specApr = ustPerYear * pair.multiplier / totalWeight / +pair.tvl;
      pair.dpr = (pair.poolApr + pair.poolAstroApr + pair.specApr) / 365;
      stat.vaultFee += pair.vaultFee;
      stat.tvl = plus(stat.tvl, pair.tvl);
    }
    stat.govApr = 0; // stat.vaultFee / stat.govPoolCount / +stat.govTvl;
    this.stat = stat;
    localStorage.setItem('stat', JSON.stringify(stat));
  }

  private async refreshGovStat(stat: Stat) {
    const poolTask = this.refreshPool();

    const state = await this.gov.query({ state: {} });
    stat.govStaked = state.total_staked;
    stat.govPoolCount = state.pools.length;

    await poolTask;
    stat.govTvl = times(stat.govStaked, this.specPrice);
    stat.tvl = plus(stat.tvl, stat.govTvl);
  }

  async refreshRewardInfos() {
    const rewardInfos: InfoService['rewardInfos'] = {};
    const tasks = this.farmInfos.filter(farmInfo => this.shouldEnableFarmInfo(farmInfo)).map(async farmInfo => {
      const rewards = await farmInfo.queryRewards();
      for (const reward of rewards) {
        rewardInfos[`${farmInfo.dex}|${reward.asset_token}|${farmInfo.denomTokenContract}`] = { ...reward, farm: farmInfo.farm, farmContract: farmInfo.farmContract };
      }
    });
    await Promise.all(tasks);
    this.rewardInfos = rewardInfos;
    localStorage.setItem('rewardInfos', JSON.stringify(rewardInfos));
  }

  async refreshTokenBalance(assetToken: string) {
    if (assetToken.startsWith('u')) {
      await this.refreshNativeTokens();
    } else {
      this.tokenBalances[assetToken] = (await this.token.balance(assetToken)).balance;
    }
  }

  async refreshPoolResponse(key: string) {
    const pairInfo = this.pairInfos[key];
    const [dex, base, denom] = key.split('|');
    const tasks: Promise<any>[] = [];
    if (!base.startsWith('u')) {
      tasks.push(this.token.balance(base)
        .then(it => this.tokenBalances[base] = it.balance));
    } else {
      tasks.push(this.refreshNativeTokens());
    }
    if (!denom.startsWith('u')) {
      tasks.push(this.token.balance(denom)
        .then(it => this.tokenBalances[denom] = it.balance));
    } else {
      tasks.push(this.refreshNativeTokens());
    }
    if (dex === 'Terraswap') {
      tasks.push(this.terraSwap.query(pairInfo.contract_addr, { pool: {} })
        .then(it => this.poolResponses[key] = it));
    } else if (dex === 'Astroport') {
      tasks.push(this.astroport.query(pairInfo.contract_addr, { pool: {} })
        .then(it => this.poolResponses[key] = it));
    }
    tasks.push(this.token.balance(pairInfo.liquidity_token)
      .then(it => this.lpTokenBalances[pairInfo.liquidity_token] = it.balance));
    await Promise.all(tasks);
  }

  @memoize(1000)
  async refreshPoolResponses() {
    await this.ensurePairInfos();
    const poolResponses: Record<string, PoolResponse> = {};
    const poolTasks: Promise<any>[] = [];
    for (const key of Object.keys(this.poolInfos)) {
      const pairInfo = this.pairInfos[key];
      if (key.split('|')[0] === 'Terraswap' && pairInfo?.contract_addr) {
        poolTasks.push(this.terraSwap.query(pairInfo.contract_addr, { pool: {} })
          .then(it => poolResponses[key] = it).catch(error => console.error('refreshPoolResponses Terraswap error: ', error)));
      } else if (key.split('|')[0] === 'Astroport' && pairInfo?.contract_addr) {
        poolTasks.push(this.astroport.query(pairInfo.contract_addr, { pool: {} })
          .then(it => poolResponses[key] = it).catch(error => console.error('refreshPoolResponses Astroport error: ', error)));
      }
    }
    await Promise.all(poolTasks);
    this.poolResponses = poolResponses;
    localStorage.setItem('poolResponses', JSON.stringify(poolResponses));
  }

  async refreshCirculation() {
    if (this.terrajs.network?.name === 'testnet'){
      const task1 = this.token.query(this.terrajs.settings.specToken, { token_info: {} });
      const task2 = this.wallet.balance(this.terrajs.settings.wallet, this.terrajs.settings.platform);
      const taskResult = await Promise.all([task1, task2]);
      this.circulation = minus(taskResult[0].total_supply, taskResult[1].locked_amount);
      return;
    } else {
      const task1 = this.token.query(this.terrajs.settings.specToken, { token_info: {} });
      const task2 = this.wallet.balance(this.terrajs.settings.wallet, this.terrajs.settings.platform);
      const task3 = this.wallet.balance(this.terrajs.settings.burnVault, this.terrajs.settings.burnVaultController);
      const taskResult = await Promise.all([task1, task2, task3]);
      this.circulation = minus(minus(taskResult[0].total_supply, taskResult[1].locked_amount), taskResult[2].staked_amount);
    }
  }

  async refreshMarketCap() {
    await Promise.all([
      this.refreshCirculation(),
      this.refreshPool(),
    ]);
    this.marketCap = +this.circulation / CONFIG.UNIT * +this.specPrice;
  }

  async updateMyTvl() {
    if (!this.terrajs.address) {
      this.rewardInfos = {};
    }

    let tvl = 0;
    const portfolio: Portfolio = {
      total_reward_ust: 0,
      gov: { pending_reward_token: 0, pending_reward_ust: 0 },
      tokens: new Map(),
      farms: new Map(),
    };
    for (const farmInfo of this.farmInfos.filter(fi => this.shouldEnableFarmInfo(fi))) {
      if (this.tokenInfos[farmInfo.rewardTokenContract]?.symbol) {
        portfolio.tokens.set(this.tokenInfos[farmInfo.rewardTokenContract].symbol, { rewardTokenContract: farmInfo.rewardTokenContract, pending_reward_token: 0, pending_reward_ust: 0 });
        portfolio.farms.set(farmInfo.farm, { bond_amount_ust: 0 });
      } else {
        console.error('updateMyTvl tokenInfos Symbol not found', farmInfo.rewardTokenContract);
      }
    }

    const specPoolResponse = this.poolResponses[`Terraswap|${this.terrajs.settings.specToken}|${Denom.USD}`];
    for (const vault of this.allVaults) {
      const rewardInfo = this.rewardInfos[vault.poolInfo.key];
      if (!rewardInfo) {
        continue;
      }
      const bond_amount = (vault.poolInfo.farmType === 'PYLON_LIQUID'
        ? +rewardInfo.bond_amount
        : +this.lpBalancePipe.transform(rewardInfo.bond_amount, this.poolResponses, vault.poolInfo.key))
        / CONFIG.UNIT || 0;
      const farmInfo = this.farmInfos.find(it => it.farmContract === this.poolInfos[vault.poolInfo.key].farmContract);
      portfolio.farms.get(farmInfo.farm).bond_amount_ust += bond_amount;

      tvl += bond_amount;
      const pending_reward_spec_ust = +this.balancePipe.transform(rewardInfo.pending_spec_reward, specPoolResponse) / CONFIG.UNIT || 0;
      tvl += pending_reward_spec_ust;
      portfolio.tokens.get('SPEC').pending_reward_ust += pending_reward_spec_ust;
      portfolio.tokens.get('SPEC').pending_reward_token += +rewardInfo.pending_spec_reward / CONFIG.UNIT;
      portfolio.tokens.get('SPEC').apr = this.stat?.govApr;
      portfolio.total_reward_ust += pending_reward_spec_ust;
      if (vault.poolInfo.farm !== 'Spectrum') {
        const rewardTokenPoolResponse = this.poolResponses[vault.poolInfo.rewardKey];
        const astroTokenPoolResponse = this.poolResponses[this.ASTRO_KEY];

        const rewardSymbol = this.tokenInfos[farmInfo.rewardTokenContract].symbol;
        if (farmInfo.dex === 'Astroport'){
          const pending_farm2_reward_ust = +this.balancePipe.transform(rewardInfo.pending_farm2_reward, rewardTokenPoolResponse) / CONFIG.UNIT || 0;
          tvl += pending_farm2_reward_ust;
          portfolio.tokens.get(rewardSymbol).pending_reward_token += rewardInfo.pending_farm2_reward ? +rewardInfo.pending_farm2_reward / CONFIG.UNIT : 0;
          portfolio.tokens.get(rewardSymbol).pending_reward_ust += pending_farm2_reward_ust;

          const pending_farm_reward_ust = +this.balancePipe.transform(rewardInfo.pending_farm_reward, astroTokenPoolResponse) / CONFIG.UNIT || 0;
          tvl += pending_farm_reward_ust;
          portfolio.tokens.get('ASTRO').pending_reward_token += rewardInfo.pending_farm_reward ? +rewardInfo.pending_farm_reward / CONFIG.UNIT : 0;
          portfolio.tokens.get('ASTRO').pending_reward_ust += pending_farm_reward_ust;

          portfolio.total_reward_ust += pending_farm_reward_ust;
          portfolio.total_reward_ust += pending_farm2_reward_ust;
        } else if (farmInfo.dex === 'Terraswap'){
          const pending_farm_reward_ust = +this.balancePipe.transform(rewardInfo.pending_farm_reward, rewardTokenPoolResponse) / CONFIG.UNIT || 0;
          tvl += pending_farm_reward_ust;
          portfolio.tokens.get(rewardSymbol).pending_reward_token += +rewardInfo.pending_farm_reward / CONFIG.UNIT;
          portfolio.tokens.get(rewardSymbol).pending_reward_ust += pending_farm_reward_ust;
          portfolio.total_reward_ust += pending_farm_reward_ust;
        }
        portfolio.tokens.get(rewardSymbol).apr = this.stat?.pairs[vault.poolInfo.rewardKey]?.farmApr;
        if (portfolio.tokens.get('ASTRO')){
          portfolio.tokens.get('ASTRO').apr = this.stat?.pairs[`Astroport|${this.terrajs.settings.astroToken}|${Denom.USD}`]?.farmApr || 0;
        }
      }
    }

    const specGovStaked = this.terrajs.address ? (await this.gov.balance()).balance : 0;
    const gov_spec_staked_ust = +this.balancePipe.transform(specGovStaked, specPoolResponse) / CONFIG.UNIT || 0;
    portfolio.gov.pending_reward_ust += gov_spec_staked_ust;
    portfolio.gov.pending_reward_token += +specGovStaked / CONFIG.UNIT;
    tvl += gov_spec_staked_ust;
    this.myTvl = tvl;

    const pendingTokenRewards = [...portfolio.tokens.values()].filter(value => value.pending_reward_token > 0);
    portfolio.avg_tokens_apr = pendingTokenRewards.reduce((sum, pr) => sum + pr.pending_reward_token * (pr.apr || 0), 0) /
      pendingTokenRewards.reduce((sum, pr) => sum + pr.pending_reward_token, 0);

    this.portfolio = portfolio;
  }

  async initializeVaultData(connected: boolean) {
    const tasks: Promise<any>[] = [];
    tasks.push(this.retrieveCachedStat());
    if (connected) {
      tasks.push(this.refreshRewardInfos());
    }

    await Promise.all(tasks);
    this.updateVaults();
    await this.updateMyTvl();
  }

  async retrieveCachedStat(skipPoolResponses = false) {
    try {
      const data = await this.httpClient.get<any>(this.terrajs.settings.specAPI + '/data?type=lpVault').toPromise();
      if (!data.stat || !data.pairInfos || !data.poolInfos || !data.tokenInfos || !data.poolResponses || !data.infoSchemaVersion) {
        throw (data);
      }
      this.tokenInfos = data.tokenInfos;
      this.stat = data.stat;
      this.pairInfos = data.pairInfos;
      this.poolInfos = data.poolInfos;
      this.circulation = data.circulation;
      this.marketCap = data.marketCap;
      localStorage.setItem('tokenInfos', JSON.stringify(this.tokenInfos));
      localStorage.setItem('stat', JSON.stringify(this.stat));
      localStorage.setItem('pairInfos', JSON.stringify(this.pairInfos));
      localStorage.setItem('poolInfos', JSON.stringify(this.poolInfos));
      localStorage.setItem('infoSchemaVersion', JSON.stringify(data.infoSchemaVersion));
      if (skipPoolResponses) {
        this.poolResponses = data.poolResponses;
        localStorage.setItem('poolResponses', JSON.stringify(this.poolResponses));
      }
    } catch (ex) {
      // fallback if api die
      console.error('Error in retrieveCachedStat: fallback local info service data init');
      console.error(ex);
      await Promise.all([this.ensureTokenInfos(), this.refreshStat()]);
      localStorage.setItem('infoSchemaVersion', '2');
    } finally {
      this.loadedNetwork = this.terrajs.settings.chainID;
    }
  }

  updateVaults() {
    if (this.loadedNetwork !== this.terrajs.settings.chainID) {
      return;
    }
    const token = this.terrajs.settings.specToken;
    if (!this.tokenInfos?.[token]) {
      return;
    }
    this.allVaults = [];
    for (const key of Object.keys(this.poolInfos)) {
      if (!this.poolInfos[key]) {
        continue;
      }
      const poolInfo = this.poolInfos[key];
      const pairStat = this.stat?.pairs[key];
      const poolApr = pairStat?.poolApr || 0;
      const poolAstroApr = pairStat?.poolAstroApr || 0;
      const poolAprTotal = poolApr + poolAstroApr;
      const poolApy = pairStat?.poolApy || 0;
      const specApr = pairStat?.specApr || 0;
      const govApr = this.stat?.govApr || 0;
      const specApy = specApr + specApr * govApr / 2;
      const compoundApy = poolApy + specApy;
      const farmApr = pairStat?.farmApr || 0;
      const farmAndAstroApr = farmApr + (this.stat.pairs[this.ASTRO_KEY]?.farmApr || 0);
      const farmApy = poolAprTotal + poolAprTotal * farmAndAstroApr / 2;
      const stakeApy = farmApy + specApy;
      const apy = Math.max(compoundApy, stakeApy);

      const baseToken = this.poolInfos[key].baseTokenContract;
      const denomToken = this.poolInfos[key].denomTokenContract;
      const rewardToken = this.poolInfos[key].rewardTokenContract;
      const baseSymbol = baseToken.startsWith('u') ? Denom.display[baseToken] : this.tokenInfos[baseToken]?.symbol;
      const denomSymbol = denomToken.startsWith('u') ? Denom.display[denomToken] : this.tokenInfos[denomToken]?.symbol;
      const disabled = this.DISABLED_VAULTS.has(`${poolInfo.dex}|${baseSymbol}|${denomSymbol}`);
      const score = poolInfo.farm === 'Spectrum' ? 2000000 : (poolInfo.highlight ? 1000000 : 0) + (pairStat?.multiplier || 0) - (disabled ? 1000000 : 0);
      const will_available_at_astroport = this.WILL_AVAILABLE_AT_ASTROPORT.has(`${poolInfo.dex}|${baseSymbol}|${denomSymbol}`);
      const now_available_at_astroport = this.NOW_AVAILABLE_AT_ASTROPORT.has(`${poolInfo.dex}|${baseSymbol}|${denomSymbol}`);
      const proxy_reward_not_yet_available = this.PROXY_REWARD_NOT_YET_AVAILABLE.has(`${poolInfo.dex}|${baseSymbol}|${denomSymbol}`);

      const vault: Vault = {
        baseSymbol,
        denomSymbol,
        rewardSymbol: this.tokenInfos[rewardToken]?.symbol,
        baseDecimals: baseToken.startsWith('u') ? CONFIG.DIGIT : this.tokenInfos[baseToken]?.decimals,
        baseUnit: baseToken.startsWith('u') ? CONFIG.UNIT : this.tokenInfos[baseToken]?.unit,
        denomDecimals: denomToken.startsWith('u') ? CONFIG.DIGIT : this.tokenInfos[denomToken]?.decimals,
        denomUnit: denomToken.startsWith('u') ? CONFIG.UNIT : this.tokenInfos[denomToken]?.unit,
        baseAssetInfo: baseToken.startsWith('u')
          ? { native_token: { denom: baseToken } }
          : { token: { contract_addr: baseToken } },
        denomAssetInfo: denomToken.startsWith('u')
          ? { native_token: { denom: denomToken } }
          : { token: { contract_addr: denomToken } },
        lpToken: this.pairInfos[key]?.liquidity_token,
        pairStat,
        poolInfo,
        pairInfo: this.pairInfos[key],
        specApy,
        farmApy,
        compoundApy,
        stakeApy,
        apy,
        name: poolInfo.farmType === 'PYLON_LIQUID'
          ? baseSymbol
          : `${baseSymbol}-${denomSymbol} LP`,
        unitDisplay: poolInfo.farmType === 'PYLON_LIQUID'
          ? baseSymbol
          : `${baseSymbol}-${denomSymbol} ${poolInfo.dex} LP`,
        shortUnitDisplay: poolInfo.farmType === 'PYLON_LIQUID'
          ? baseSymbol
          : `LP`,
        score,
        fullName: poolInfo.farmType === 'PYLON_LIQUID'
          ? baseSymbol
          : `${baseSymbol}-${denomSymbol} LP`,
        disabled,
        will_available_at_astroport,
        now_available_at_astroport,
        proxy_reward_not_yet_available,
        poolAprTotal
      };
      this.allVaults.push(vault);
    }
  }

  private async ensureAstroportData() {
    if (!this.astroportData || !this.lastRefreshAstroportData || this.lastRefreshAstroportData > Date.now() + 10 * 60 * 1000) {
      const apollo = this.apollo.use('astroport');
      this.astroportData = (await apollo.query<any>({
        query: gql`query {
                      pools {
                        pool_address
                        token_symbol
                        trading_fees {
                          apy
                          apr
                          day
                        }
                        astro_rewards {
                          apy
                          apr
                          day
                        }
                        protocol_rewards {
                          apy
                          apr
                          day
                        }
                        total_rewards {
                          apy
                          apr
                          day
                        }
                      }
                    }`,
        errorPolicy: 'all'
      }).toPromise()).data;
      this.lastRefreshAstroportData = Date.now();
    }
  }

}
