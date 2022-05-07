import {Inject, Injectable} from '@angular/core';
import {BLOCK_TIME, TerrajsService} from './terrajs.service';
import {TokenService} from './api/token.service';
import {BankService} from './api/bank.service';
import {TerraSwapService} from './api/terraswap.service';
import {PoolResponse} from './api/terraswap_pair/pool_response';
import {div, gt, minus, plus, times} from '../libs/math';
import {CONFIG} from '../consts/config';
import {TerraSwapFactoryService} from './api/terraswap-factory.service';
import {GovService} from './api/gov.service';
import {
  FARM_INFO_SERVICE,
  FARM_TYPE_SINGLE_TOKEN,
  FarmInfoService,
  PairStat,
  PoolInfo,
  PoolItem,
  RewardInfoResponseItem
} from './farm_info/farm-info.service';
import {fromEntries} from '../libs/core';
import {PairInfo} from './api/astroport_pair/pair_info';
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
import {AnchorMarketService} from './api/anchor-market.service';
import {BalanceResponse} from './api/gov/balance_response';
import {StateInfo} from './api/gov/state_info';
import {QueryBundler} from './querier-bundler';
import {WasmService} from './api/wasm.service';

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
  totalGovRewardUST: number;
  stakedInGovAPR: number;
  austAPR: number;
};

export interface GovPoolDetail {
  days: number;
  balance: string;
  apr: number;
  userBalance: string;
  userAUst: string;
  userProfit: string;
  austApr: number;
  userAvailableBalance: string;
  unlockAt: Date | null;
  moveOptions: { days: number; userBalance: string; unlockAt: Date | null }[];
}

export type TokenInfo = {
  name: string;
  symbol: string;
  decimals: number;
  unit: number;
};

const HEIGHT_PER_YEAR = 365 * 24 * 60 * 60 * 1000 / BLOCK_TIME;

export const defaultFarmConfig = {
  controller_fee: 0.01,
  platform_fee: 0.01,
  community_fee: 0.06,
};

@Injectable({
  providedIn: 'root'
})
export class InfoService {

  userUstAmount: string;
  userSpecAmount: string;
  userSpecLpAmount: string;
  specPoolInfo: PoolResponse;
  specPrice: string;
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
  govBalanceResponse: BalanceResponse;
  govStateInfo: StateInfo;
  poolDetails: GovPoolDetail[] = [];
  myTvl = 0;
  allVaults: Vault[] = [];
  portfolio: Portfolio;
  astroportData: any;
  private loadedNetwork: string;
  private DISABLED_VAULTS: Set<string> = new Set(['Astroport|STT|UST', 'Terraswap|mAMC|UST', 'Terraswap|mGME|UST', 'Terraswap|VKR|UST', 'Terraswap|MIR|UST', 'Terraswap|ANC|UST', 'Terraswap|MINE|UST', 'Terraswap|ORION|UST', 'Terraswap|Psi|UST', 'Terraswap|nLuna|Psi', 'Terraswap|nETH|Psi']);
  private WILL_AVAILABLE_AT_ASTROPORT: Set<string> = new Set([]);
  private NOW_AVAILABLE_AT_ASTROPORT: Set<string> = new Set(['Terraswap|MIR|UST', 'Terraswap|ANC|UST', 'Terraswap|VKR|UST', 'Terraswap|ORION|UST', 'Terraswap|MINE|UST', 'Terraswap|Psi|UST', 'Terraswap|nLuna|Psi', 'Terraswap|nETH|Psi']);
  private PROXY_REWARD_NOT_YET_AVAILABLE: Set<string> = new Set([]);
  private PROXY_REWARD_STOPPED: Set<string> = new Set(['Astroport|ANC|UST']);

  constructor(
    private bankService: BankService,
    @Inject(FARM_INFO_SERVICE) public farmInfos: FarmInfoService[],
    private gov: GovService,
    public terrajs: TerrajsService,
    private terraSwap: TerraSwapService,
    private astroport: AstroportService,
    private terraSwapFactory: TerraSwapFactoryService,
    private astroportFactory: AstroportFactoryService,
    private token: TokenService,
    private balancePipe: BalancePipe,
    private lpBalancePipe: LpBalancePipe,
    private httpClient: HttpClient,
    private wallet: WalletService,
    private apollo: Apollo,
    private anchorMarket: AnchorMarketService,
    private wasm: WasmService,
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
        if (this.terrajs.isConnected) {
          const rewardInfoJson = localStorage.getItem('rewardInfos');
          if (rewardInfoJson) {
            this.rewardInfos = JSON.parse(rewardInfoJson);
          }
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
    } catch (e) {
    }
  }

  get ASTRO_KEY() {
    return `Astroport|${this.terrajs.settings.astroToken}|${Denom.USD}`;
  }

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
    await Promise.all(tasks);
  }

  @memoize(1000)
  async refreshNativeTokens() {
    const it = await this.bankService.balances();
    this.userUstAmount = div(it.get(Denom.USD)?.amount.toNumber() ?? 0, CONFIG.UNIT);
    for (const coin of it.toArray()) {
      this.tokenBalances[coin.denom] = coin.amount.toString() ?? '0';
    }
    if (!this.tokenBalances[Denom.LUNA] || !it.toArray().find(coin => coin.denom === Denom.LUNA)) {
      this.tokenBalances[Denom.LUNA] = '0';
    }
  }

  @memoize(1000)
  async refreshPool() {
    this.specPoolInfo = await this.terraSwap.query(this.terrajs.settings.specPool, {pool: {}});
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
    const bundler = new QueryBundler(this.wasm);
    const tasks: Promise<any>[] = [];
    for (const farmInfo of this.farmInfos) {
      if (!this.shouldEnableFarmInfo(farmInfo)) {
        continue;
      }
      const task = bundler.query(farmInfo.farmContract, {pools: {}})
        .then(async ({pools}: { pools: PoolItem[] }) => {
          for (const pool of pools) {
            const key = farmInfo.farmType === 'LP' ? `${farmInfo.dex}|${pool.asset_token}|${farmInfo.denomTokenContract}` : `${pool.asset_token}`;
            let farmConfig;
            if (farmInfo.getConfig) {
              farmConfig = await farmInfo.getConfig();
            } else {
              farmConfig = defaultFarmConfig;
            }
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
                notUseAstroportGqlApr: farmInfo.notUseAstroportGqlApr,
                farmConfig,
              });
          }
        });
      tasks.push(task);
    }
    bundler.flush();
    await Promise.all(tasks);

    localStorage.setItem('poolInfos', JSON.stringify(poolInfos));
    this.poolInfos = poolInfos;
  }

  async ensurePairInfos() {
    await this.ensurePoolInfoLoaded();
    const bundler = new QueryBundler(this.wasm);
    const tasks: Promise<any>[] = [];
    for (const key of Object.keys(this.poolInfos)) {
      if (this.pairInfos[key]) {
        continue;
      }

      let pairInfoKey: string;
      const baseTokenContract = this.poolInfos[key].baseTokenContract;
      const denomTokenContract = this.poolInfos[key].denomTokenContract;
      if (this.poolInfos[key].farmType === 'LP') {
        pairInfoKey = key;
      } else if (FARM_TYPE_SINGLE_TOKEN.has(this.poolInfos[key].farmType)) {
        pairInfoKey = `${this.poolInfos[key].dex}|${baseTokenContract}|${denomTokenContract}`;
      } else {
        continue;
      }
      const tokenA = baseTokenContract.startsWith('u') ?
        {native_token: {denom: baseTokenContract}} : {token: {contract_addr: baseTokenContract}};
      const tokenB = denomTokenContract.startsWith('u') ?
        {native_token: {denom: denomTokenContract}} : {token: {contract_addr: denomTokenContract}};

      let factory: string;
      if (this.poolInfos[key].dex === 'Terraswap') {
        factory = this.terrajs.settings.terraSwapFactory;
      } else if (this.poolInfos[key].dex === 'Astroport') {
        factory = this.terrajs.settings.astroportFactory;
      } else {
        continue;
      }

      const task = bundler.query(factory, {
        pair: {
          asset_infos: [
            tokenA, tokenB
          ]
        }
      }).then(value => this.pairInfos[pairInfoKey] = value);
      tasks.push(task);
    }

    if (tasks.length) {
      bundler.flush();
      await Promise.all(tasks);
      localStorage.setItem('pairInfos', JSON.stringify(this.pairInfos));
    }
  }

  async ensureTokenInfos() {
    await this.ensurePoolInfoLoaded();
    const cw20Tokens = new Set<string>();
    const bundler = new QueryBundler(this.wasm);
    const tasks: Promise<any>[] = [];
    for (const key of Object.keys(this.poolInfos)) {
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
    }
    for (const key of cw20Tokens) {
      if (this.tokenInfos[key]) {
        continue;
      }
      const task = bundler.query(key, {token_info: {}})
        .then(it => this.tokenInfos[key] = {
          name: it.name,
          symbol: this.cleanSymbol(it.symbol),
          decimals: it.decimals,
          unit: 10 ** it.decimals,
        });
      tasks.push(task);
    }
    if (tasks.length) {
      bundler.flush();
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
    await Promise.all([
      this.refreshPoolResponses(),
      this.ensureAstroportData().catch(_ => {
      }),
    ]);

    const vaults = await vaultsTask;
    const tasks = this.farmInfos.filter(farmInfo => this.shouldEnableFarmInfo(farmInfo)).map(async farmInfo => {
      const farmPoolInfos = fromEntries(Object.entries(this.poolInfos)
        .filter(it => it[1].farmContract === farmInfo.farmContract));
      try {
        const pairStats = await farmInfo.queryPairStats(farmPoolInfos, this.poolResponses, vaults, this.pairInfos);
        const keys = Object.keys(pairStats);
        for (const key of keys) {
          if (!pairStats[key].poolAstroApr) {
            pairStats[key].poolAstroApr = 0;
          }
          const farmConfig = this.poolInfos[key]?.farmConfig || defaultFarmConfig;
          const totalFee = +farmConfig.controller_fee + +farmConfig.platform_fee + +farmConfig.community_fee;
          // if (farmInfo.dex === 'Astroport'){
          // if farmInfo.queryPairStats return poolApr 0 and poolAstroApr 0, meaning that do not use calculation on Spectrum side but use Astroport API
          if (farmInfo.dex === 'Astroport' && farmInfo.farmType === 'LP') {
            const found = this.astroportData.pools.find(pool => pool?.pool_address === this.pairInfos[key]?.contract_addr);
            if (farmInfo.notUseAstroportGqlApr) {
              const pair = pairStats[key];
              const proxyAndAstroApy = (((+pair.poolApr + +pair.poolAstroApr) * (1 - totalFee)) / 8760 + 1) ** 8760 - 1;
              const foundTradingFeeApr = +found?.trading_fees?.apr || 0;
              pair.poolApy = proxyAndAstroApy > 0 ? (proxyAndAstroApy + 1) * (foundTradingFeeApr + 1) - 1 : 0;
            } else {
              // to prevent set pairStat undefined in case of no data available from Astroport api
              if (found) {
                const pair = pairStats[key];
                pair.poolApr = +found.protocol_rewards.apr;
                pair.poolAstroApr = +found.astro_rewards.apr;
                const proxyAndAstroApy = (((+found.protocol_rewards.apr + +found.astro_rewards.apr) * (1 - totalFee)) / 8760 + 1) ** 8760 - 1;
                pair.poolApy = proxyAndAstroApy > 0 ? (proxyAndAstroApy + 1) * (+found.trading_fees.apy + 1) - 1 : 0;
                pair.vaultFee = +pair.tvl * (pair.poolApr + pair.poolAstroApr) * 0.06;
                // pairStats[key].poolApy = ((+found.protocol_rewards.apr + +found.astro_rewards.apr) / 8760 + 1) ** 8760 - 1;
                // this.poolInfos[key].tradeApr = +found.trading_fees.apr;
              }
            }
          }
          if (farmInfo.dex === 'Terraswap' && farmInfo.farmType === 'LP') {
            // supported only in backend
          } else if (FARM_TYPE_SINGLE_TOKEN.has(farmInfo.farmType)) {
            const poolApy = ((+pairStats[key].poolApr * (1 - totalFee)) / 8760 + 1) ** 8760 - 1;
            pairStats[key].poolApy = pairStats[key].poolApr > 0 ? poolApy : 0;
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

    // aUST in Gov
    const anchorState = await this.anchorMarket.query({epoch_state: {}});
    const austBalance = await this.token.balance(this.terrajs.settings.austToken, this.terrajs.settings.gov);
    const austValue = times(austBalance.balance, anchorState.exchange_rate);
    stat.tvl = plus(stat.tvl, austValue);

    this.stat = stat;
    localStorage.setItem('stat', JSON.stringify(stat));
  }

  async refreshRewardInfos() {
    const rewardInfos: InfoService['rewardInfos'] = {};
    const bundler = new QueryBundler(this.wasm, 8);
    const tasks: Promise<any>[] = [];
    const BUNDLER_BLACKLIST = new Set([this.terrajs.settings.mirrorFarm]);
    const processRewards = (farmInfo: FarmInfoService, rewards: RewardInfoResponseItem[]) => {
      if (farmInfo.farmContract === this.terrajs.settings.specFarm) {
        for (const it of rewards) {
          it['stake_bond_amount'] = it.bond_amount;
        }
      }
      for (const reward of rewards) {
        if (farmInfo.farmType === 'LP') {
          rewardInfos[`${farmInfo.dex}|${reward.asset_token}|${farmInfo.denomTokenContract}`] = {
            ...reward,
            farm: farmInfo.farm,
            farmContract: farmInfo.farmContract
          };
        } else if (FARM_TYPE_SINGLE_TOKEN.has(farmInfo.farmType)) {
          rewardInfos[`${reward.asset_token}`] = {...reward, farm: farmInfo.farm, farmContract: farmInfo.farmContract};
        }
      }
    };

    for (const farmInfo of this.farmInfos) {
      if (!this.shouldEnableFarmInfo(farmInfo)) {
        continue;
      }
      let task;
      if (BUNDLER_BLACKLIST.has(farmInfo.farmContract)) {
        task = this.wasm.query(farmInfo.farmContract, {
          reward_info: {
            staker_addr: this.terrajs.address,
          }
        }).then(({reward_infos: rewards}: { reward_infos: RewardInfoResponseItem[] }) => processRewards(farmInfo, rewards));
      } else {
        task = bundler.query(farmInfo.farmContract, {
          reward_info: {
            staker_addr: this.terrajs.address,
          }
        }).then(({reward_infos: rewards}: { reward_infos: RewardInfoResponseItem[] }) => processRewards(farmInfo, rewards));
      }
      tasks.push(task);
    }

    bundler.flush();
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
    const bundler = new QueryBundler(this.wasm);
    const tasks: Promise<any>[] = [];

    const balanceQuery = {
      balance: {
        address: this.terrajs.address
      }
    };
    if (!base.startsWith('u')) {
      tasks.push(bundler.query(base, balanceQuery)
        .then(it => this.tokenBalances[base] = it.balance));
    } else {
      tasks.push(this.refreshNativeTokens());
    }
    if (!denom.startsWith('u')) {
      tasks.push(bundler.query(denom, balanceQuery)
        .then(it => this.tokenBalances[denom] = it.balance));
    } else {
      tasks.push(this.refreshNativeTokens());
    }
    tasks.push(bundler.query(pairInfo.contract_addr, {pool: {}})
      .then(it => this.poolResponses[key] = it));

    tasks.push(bundler.query(pairInfo.liquidity_token, balanceQuery)
      .then(it => this.lpTokenBalances[pairInfo.liquidity_token] = it.balance));

    bundler.flush();
    await Promise.all(tasks);
  }

  @memoize(1000)
  async refreshPoolResponses() {
    await this.ensurePairInfos();
    const poolResponses: Record<string, PoolResponse> = {};
    const bundler = new QueryBundler(this.wasm);
    const poolTasks: Promise<any>[] = [];
    for (const key of Object.keys(this.poolInfos)) {
      let poolResponseKey: string;
      const dex = this.poolInfos[key].dex;
      if (this.poolInfos[key].farmType === 'LP') {
        poolResponseKey = key;
      } else if (FARM_TYPE_SINGLE_TOKEN.has(this.poolInfos[key].farmType)) {
        const baseTokenContract = this.poolInfos[key].baseTokenContract;
        const denomTokenContract = this.poolInfos[key].denomTokenContract;
        poolResponseKey = `${dex}|${baseTokenContract}|${denomTokenContract}`;
      }
      const pairInfo = this.pairInfos[poolResponseKey];

      poolTasks.push(bundler.query(pairInfo.contract_addr, {pool: {}})
        .then(it => poolResponses[poolResponseKey] = it));
    }

    bundler.flush();
    await Promise.all(poolTasks)
      .catch(error => console.error('refreshPoolResponses error: ', error));
    this.poolResponses = poolResponses;
    localStorage.setItem('poolResponses', JSON.stringify(poolResponses));
  }

  async refreshCirculation() {
    // testnet doesn't have burnvault
    if (this.terrajs.network?.name === 'testnet') {
      const task1 = this.token.query(this.terrajs.settings.specToken, {token_info: {}});
      const task2 = this.wallet.balance(this.terrajs.settings.wallet, this.terrajs.settings.platform);
      const taskResult = await Promise.all([task1, task2]);
      this.circulation = minus(taskResult[0].total_supply, taskResult[1].locked_amount);
      return;
    } else {
      const bundler = new QueryBundler(this.wasm);
      const task1 = bundler.query(this.terrajs.settings.specToken, {token_info: {}});
      const task2 = bundler.query(this.terrajs.settings.wallet, {
        balance: {
          address: this.terrajs.settings.platform
        }
      });
      const task3 = bundler.query(this.terrajs.settings.burnVault, {
        balance: {
          address: this.terrajs.settings.burnVaultController
        }
      });
      bundler.flush();
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
      gov: {pending_reward_token: 0, pending_reward_ust: 0},
      tokens: new Map(),
      farms: new Map(),
      totalGovRewardUST: 0,
      stakedInGovAPR: 0,
      austAPR: 0,
    };
    for (const farmInfo of this.farmInfos.filter(fi => this.shouldEnableFarmInfo(fi))) {
      if (this.tokenInfos[farmInfo.rewardTokenContract]?.symbol) {
        portfolio.tokens.set(this.tokenInfos[farmInfo.rewardTokenContract].symbol, {
          rewardTokenContract: farmInfo.rewardTokenContract,
          pending_reward_token: 0,
          pending_reward_ust: 0
        });
        portfolio.farms.set(farmInfo.farm, {bond_amount_ust: 0});
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
      let bond_amount;
      if (vault.poolInfo.farmType === 'PYLON_LIQUID') {
        bond_amount = +rewardInfo.bond_amount;
      } else if ((vault.poolInfo.farmType === 'NASSET')) {
        bond_amount = +this.balancePipe.transform(rewardInfo.bond_amount,
          this.poolResponses[`${vault.poolInfo.dex}|${vault.poolInfo.baseTokenContract}|${this.terrajs.settings.nexusToken}`],
          this.poolResponses[vault.poolInfo.rewardKey]);
      } else {
        bond_amount = +this.lpBalancePipe.transform(rewardInfo.bond_amount, this, vault.poolInfo.key);
      }
      bond_amount = bond_amount / CONFIG.UNIT || 0;

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
        let rewardKey;
        if (this.NOW_AVAILABLE_AT_ASTROPORT.has(`${vault.poolInfo.dex}|${vault.baseSymbol}|${vault.denomSymbol}`)) {
          rewardKey = `Astroport|${vault.poolInfo.baseTokenContract}|${vault.poolInfo.denomTokenContract}`; // if has pending farm reward from disabled terraswap vault, then should use data from astroport vaults
        } else {
          rewardKey = vault.poolInfo.rewardKey;
        }
        const rewardTokenPoolResponse = this.poolResponses[rewardKey];
        const astroTokenPoolResponse = this.poolResponses[this.ASTRO_KEY];

        const rewardSymbol = this.tokenInfos[farmInfo.rewardTokenContract].symbol;
        if (farmInfo.dex === 'Astroport' && farmInfo.farmType === 'LP') {
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
        } else if (farmInfo.dex === 'Terraswap' || FARM_TYPE_SINGLE_TOKEN.has(farmInfo.farmType)) {
          const pending_farm_reward_ust = +this.balancePipe.transform(rewardInfo.pending_farm_reward, rewardTokenPoolResponse) / CONFIG.UNIT || 0;
          tvl += pending_farm_reward_ust;
          portfolio.tokens.get(rewardSymbol).pending_reward_token += +rewardInfo.pending_farm_reward / CONFIG.UNIT;
          portfolio.tokens.get(rewardSymbol).pending_reward_ust += pending_farm_reward_ust;
          portfolio.total_reward_ust += pending_farm_reward_ust;
        }
        portfolio.tokens.get(rewardSymbol).apr = this.stat?.pairs[rewardKey]?.farmApr;
        if (portfolio.tokens.get('ASTRO')) {
          portfolio.tokens.get('ASTRO').apr = this.stat?.pairs[`Astroport|${this.terrajs.settings.astroToken}|${Denom.USD}`]?.farmApr || 0;
        }
      }
    }

    const specGovStaked = this.terrajs.address ? (await this.gov.balance()).balance : 0;
    const gov_spec_staked_ust = +this.balancePipe.transform(specGovStaked, specPoolResponse) / CONFIG.UNIT || 0;
    portfolio.gov.pending_reward_ust += gov_spec_staked_ust;
    portfolio.gov.pending_reward_token += +specGovStaked / CONFIG.UNIT;
    tvl += gov_spec_staked_ust;


    const pendingTokenRewards = [...portfolio.tokens.values()].filter(value => value.pending_reward_token > 0);
    portfolio.avg_tokens_apr = pendingTokenRewards.reduce((sum, pr) => sum + pr.pending_reward_token * (pr.apr || 0), 0) /
      pendingTokenRewards.reduce((sum, pr) => sum + pr.pending_reward_token, 0);

    let sumGovAPR = 0;
    let totalStaked = 0;
    for (const pool of this.poolDetails) {
      sumGovAPR += +pool.userBalance * pool.apr;
      totalStaked += +pool.userBalance;
      portfolio.totalGovRewardUST += +pool.userProfit;
      portfolio.austAPR = +pool.austApr;
    }
    portfolio.stakedInGovAPR = sumGovAPR / totalStaked;

    tvl += portfolio.totalGovRewardUST;

    this.myTvl = tvl;
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
    await this.fetchPoolDetails();

    if (connected) {
      await this.updateMyTvl();
    }
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
      if (!skipPoolResponses) {
        this.poolResponses = data.poolResponses;
        localStorage.setItem('poolResponses', JSON.stringify(this.poolResponses));
      }

      // no more fallback
    } catch (ex) {
      // fallback if api die
      console.error('Error in retrieveCachedStat: fallback local info service data init');
      console.error(ex);
      await Promise.all([this.ensureTokenInfos(), this.refreshStat()]);
      localStorage.setItem('infoSchemaVersion', '3');
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
      const baseToken = this.poolInfos[key].baseTokenContract;
      const denomToken = this.poolInfos[key].denomTokenContract;
      const rewardToken = this.poolInfos[key].rewardTokenContract;
      const baseSymbol = baseToken.startsWith('u') ? Denom.display[baseToken] : this.tokenInfos[baseToken]?.symbol;
      const denomSymbol = denomToken.startsWith('u') ? Denom.display[denomToken] : this.tokenInfos[denomToken]?.symbol;
      const poolInfo = this.poolInfos[key];

      const shouldSetAprZero = this.DISABLED_VAULTS.has(`${poolInfo.dex}|${baseSymbol}|${denomSymbol}`);

      const pairStat = this.stat?.pairs[key];
      const poolApr = shouldSetAprZero ? 0 : pairStat?.poolApr || 0;
      const poolAstroApr = shouldSetAprZero ? 0 : pairStat?.poolAstroApr || 0;
      const poolAprTotal = shouldSetAprZero ? 0 : poolApr + poolAstroApr;
      const poolApy = shouldSetAprZero ? 0 : pairStat?.poolApy || 0;
      const specApr = shouldSetAprZero ? 0 : pairStat?.specApr || 0;
      const govApr = this.stat?.govApr || 0;
      const specApy = specApr + specApr * govApr / 2;
      const compoundApy = poolApy + specApy;
      const farmApr = +(pairStat?.farmApr || 0);

      let farmApy = 0;
      if (poolInfo.auto_stake && !shouldSetAprZero) {
        let astroApy = 0;
        let farm2Apy = 0;
        const totalFee = +poolInfo.farmConfig.controller_fee + +poolInfo.farmConfig.platform_fee + +poolInfo.farmConfig.community_fee;
        if (poolInfo.dex === 'Astroport' && poolInfo.farmType === 'LP') {
          const astroApr = (this.stat.pairs[this.ASTRO_KEY]?.farmApr || 0);
          const poolAstroAprWithFee = poolAstroApr * (1 - totalFee);
          astroApy = poolAstroAprWithFee + poolAstroAprWithFee * astroApr / 2;
        }
        if (!this.PROXY_REWARD_STOPPED.has(`${poolInfo.dex}|${baseSymbol}|${denomSymbol}`)) {
          const poolAprWithFee = poolApr * (1 - totalFee);
          farm2Apy = poolAprWithFee + poolAprWithFee * farmApr / 2;
        }
        const tradeApr = poolInfo.tradeApr || 0;
        farmApy = astroApy + farm2Apy + tradeApr;
      }

      const stakeApy = farmApy + specApy;
      const apy = Math.max(compoundApy, stakeApy);

      const disabled = this.DISABLED_VAULTS.has(`${poolInfo.dex}|${baseSymbol}|${denomSymbol}`);
      let score;
      if (poolInfo.farm === 'Spectrum') {
        score = 2000000;
      } else if (disabled) {
        score = 2100000;
      } else {
        score = (poolInfo.highlight ? 1000000 : 0) + (pairStat?.multiplier || 0);
      }
      const will_available_at_astroport = this.WILL_AVAILABLE_AT_ASTROPORT.has(`${poolInfo.dex}|${baseSymbol}|${denomSymbol}`);
      const now_available_at_astroport = this.NOW_AVAILABLE_AT_ASTROPORT.has(`${poolInfo.dex}|${baseSymbol}|${denomSymbol}`);
      const proxy_reward_not_yet_available = this.PROXY_REWARD_NOT_YET_AVAILABLE.has(`${poolInfo.dex}|${baseSymbol}|${denomSymbol}`);
      const abbreviatedDex = poolInfo.dex === 'Astroport' ? 'Astro' : poolInfo.dex === 'Terraswap' ? 'TS' : poolInfo.dex;

      const vault: Vault = {
        baseSymbol,
        denomSymbol,
        rewardSymbol: this.tokenInfos[rewardToken]?.symbol,
        baseDecimals: baseToken.startsWith('u') ? CONFIG.DIGIT : this.tokenInfos[baseToken]?.decimals,
        baseUnit: baseToken.startsWith('u') ? CONFIG.UNIT : this.tokenInfos[baseToken]?.unit,
        denomDecimals: denomToken.startsWith('u') ? CONFIG.DIGIT : this.tokenInfos[denomToken]?.decimals,
        denomUnit: denomToken.startsWith('u') ? CONFIG.UNIT : this.tokenInfos[denomToken]?.unit,
        baseAssetInfo: baseToken.startsWith('u')
          ? {native_token: {denom: baseToken}}
          : {token: {contract_addr: baseToken}},
        denomAssetInfo: denomToken.startsWith('u')
          ? {native_token: {denom: denomToken}}
          : {token: {contract_addr: denomToken}},
        lpToken: this.pairInfos[key]?.liquidity_token,
        pairStat,
        poolInfo,
        pairInfo: this.pairInfos[key],
        specApy,
        farmApy,
        compoundApy,
        stakeApy,
        apy,
        name: FARM_TYPE_SINGLE_TOKEN.has(poolInfo.farmType)
          ? baseSymbol
          : `${baseSymbol}-${denomSymbol} LP`,
        unitDisplay: FARM_TYPE_SINGLE_TOKEN.has(poolInfo.farmType)
          ? baseSymbol
          : `${baseSymbol}-${denomSymbol} ${poolInfo.dex} LP`,
        unitDisplayDexAbbreviated: FARM_TYPE_SINGLE_TOKEN.has(poolInfo.farmType)
          ? baseSymbol
          : `${baseSymbol}-${denomSymbol} ${abbreviatedDex} LP`,
        shortUnitDisplay: FARM_TYPE_SINGLE_TOKEN.has(poolInfo.farmType)
          ? baseSymbol
          : `LP`,
        score,
        fullName: FARM_TYPE_SINGLE_TOKEN.has(poolInfo.farmType)
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

  async fetchPoolDetails() {

    const [state, rates] = await Promise.all([
      this.anchorMarket.query({epoch_state: {}}),
      this.httpClient.get<any>(this.terrajs.settings.anchorAPI + '/deposit-rate').toPromise().catch(_ => undefined),
      this.gov.state().then(it => this.govStateInfo = it),
      this.terrajs.isConnected
        ? this.gov.balance().then(it => this.govBalanceResponse = it)
        : Promise.resolve(null as BalanceResponse),
      this.refreshPool(),
    ]);

    const anchorRatePerBlock = rates?.[0]?.deposit_rate ?? '0.000000041729682765';
    const anchorRatePerYear = times(anchorRatePerBlock, 4656810);

    const vaultFeeByPools = {};
    let lockedBalance = '0';

    const vaultFeeSlice = this.stat.vaultFee / this.govStateInfo.pool_weight;
    for (let n = 0; n < this.govStateInfo.pools.length; n++) {
      const involvedPools = this.govStateInfo.pools.slice(n);
      const sumTotalBalance = involvedPools.reduce((sum, pool) => sum + +pool.total_balance, 0);
      const pivotPool = involvedPools[0];

      for (const pool of involvedPools) {
        const poolVaultFee = +pool.total_balance / sumTotalBalance * vaultFeeSlice * pivotPool.weight;
        vaultFeeByPools[pool.days] = (vaultFeeByPools[pool.days] || 0) + poolVaultFee;
      }
    }

    if (this.govBalanceResponse) {
      const mostLockedBalance = this.govBalanceResponse.locked_balance.reduce((c, [_, {balance}]) => Math.max(c, +balance), 0);
      lockedBalance = div(mostLockedBalance, CONFIG.UNIT);
    }

    this.poolDetails = this.govStateInfo.pools
      .map((pool) => {
        const balanceInfo = this.govBalanceResponse?.pools.find(p => p.days === pool.days);
        const userBalance = div(balanceInfo?.balance ?? 0, CONFIG.UNIT);
        const userAUst = div(balanceInfo?.pending_aust ?? 0, CONFIG.UNIT);
        const userProfit = times(userAUst, state.exchange_rate);
        const unlockAt = balanceInfo?.unlock ? new Date(balanceInfo.unlock * 1000) : null;
        const poolTvl = +pool.total_balance * +this.specPrice;
        const apr = vaultFeeByPools[pool.days] / poolTvl;
        const austApr = +anchorRatePerYear;
        return {
          userBalance,
          userAUst,
          userProfit,
          austApr,
          unlockAt,
          days: pool.days,
          apr: apr + apr * +anchorRatePerYear / 2,
          balance: div(pool.total_balance, CONFIG.UNIT),
          userAvailableBalance: '0', // populate after this mapping
          moveOptions: [], // populate after this mapping
        };
      })
      .map((current, _, poolDetails) => {
        const sumOtherPoolsBalance = poolDetails.filter(d => d.days !== current.days)
          .reduce((sum, d) => plus(sum, d.userBalance), '0');

        const unreservedBalance = minus(lockedBalance, sumOtherPoolsBalance);
        const userAvailableBalance = gt(unreservedBalance, 0)
          ? minus(current.userBalance, unreservedBalance)
          : current.userBalance;

        const moveOptions = poolDetails.filter(d => d.days > current.days)
          .map(({days, userBalance, unlockAt}) => ({days, userBalance, unlockAt}));

        return {
          ...current,
          userAvailableBalance,
          moveOptions,
        };
      });
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

  private async refreshGovStat(stat: Stat) {
    const poolTask = this.refreshPool();

    const state = await this.gov.query({state: {}});
    stat.govStaked = state.total_staked;
    stat.govPoolCount = state.pools.length;

    await poolTask;
    stat.govTvl = times(stat.govStaked, this.specPrice);
    stat.tvl = plus(stat.tvl, stat.govTvl);
  }

  @memoize(30000)
  private async ensureAstroportData() {
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
  }

}
