import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { PoolItem } from '../../api/astroport_token_ust_farm/pools_response';
import { RewardInfoResponseItem } from '../../api/astroport_token_ust_farm/reward_info_response';
import { TerrajsService } from '../../terrajs.service';
import {
  DEX,
  FarmInfoService,
  FARM_TYPE_ENUM,
  PairStat,
  PoolInfo
} from './../farm-info.service';
import {PoolResponse} from '../../api/terraswap_pair/pool_response';
import {VaultsResponse} from '../../api/gov/vaults_response';
import {Denom} from '../../../consts/denom';
import {AstroportTokenUstFarmService} from '../../api/astroport-tokenust-farm.service';
import {WasmService} from '../../api/wasm.service';
import {PairInfo} from '../../api/terraswap_factory/pair_info';
import { div } from '../../../libs/math';
import { BalancePipe } from '../../../pipes/balance.pipe';
import { TokenService } from '../../api/token.service';

@Injectable()
export class AstroportApolloUstFarmInfoService implements FarmInfoService {
  farm = 'Apollo';
  autoCompound = true;
  autoStake = false;
  farmColor = '#fd9254';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Astroport';
  denomTokenContract = Denom.USD;
  highlight = false;
  mainnetOnly = true;
  hasProxyReward = true;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.apolloToken;
  }

  constructor(
    private farmService: AstroportTokenUstFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService,
    private token: TokenService,
  ) {
  }

  get farmContract() {
    return this.terrajs.settings.astroportApolloUstFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.apolloToken;
  }

  get farmGovContract() {
    return null;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.farmService.query(this.farmContract, { pools: {} });
    return pool.pools;
  }

  //// Spectrum calculation
  // async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
  //   const key = `${this.dex}|${this.defaultBaseTokenContract}|${Denom.USD}`;
  //   const depositAmountTask = this.wasm.query(this.terrajs.settings.astroportGenerator, { deposit: { lp_token: pairInfos[key].liquidity_token, user: this.farmContract }});
  //   const farmConfigTask = this.farmService.query(this.farmContract, { config: {} });
  //   const astroPrice = this.balancePipe.transform('1', poolResponses[`Astroport|${this.terrajs.settings.astroToken}|${Denom.USD}`]);
  //
  //   // action
  //   const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
  //   const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
  //   const lpStatTask = this.getLPStat(poolResponses[key], +astroPrice);
  //   const pairs: Record<string, PairStat> = {};
  //
  //   const [lpStat, depositAmount, farmConfig] = await Promise.all([lpStatTask, depositAmountTask, farmConfigTask]);
  //
  //   const communityFeeRate = +farmConfig.community_fee;
  //   const p = poolResponses[key];
  //   const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
  //   if (!uusd) {
  //     return;
  //   }
  //
  //   const poolApr = +(lpStat.apr || 0);
  //   pairs[key] = createPairStat(poolApr, key);
  //   const pair = pairs[key];
  //   pair.tvl = new BigNumber(uusd.amount)
  //     .times(depositAmount)
  //     .times(2)
  //     .div(p.total_share)
  //     .toString();
  //   pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;
  //
  //   return pairs;
  //
  //   // tslint:disable-next-line:no-shadowed-variable
  //   function createPairStat(poolApr: number, key: string) {
  //     const poolInfo = poolInfos[key];
  //     const stat: PairStat = {
  //       poolApr,
  //       poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
  //       farmApr: +(0),
  //       tvl: '0',
  //       multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
  //       vaultFee: 0,
  //     };
  //     return stat;
  //   }
  // }

  // no LP APR calculation, return 0 to use Astroport API
  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const key = `${this.dex}|${this.defaultBaseTokenContract}|${Denom.USD}`;
    const depositAmountTask = this.token.balance(pairInfos[key].liquidity_token, this.farmContract);
    const farmConfigTask = this.farmService.query(this.farmContract, { config: {} });

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
    const pairs: Record<string, PairStat> = {};

    const [depositAmount, farmConfig] = await Promise.all([depositAmountTask, farmConfigTask]);

    const communityFeeRate = +farmConfig.community_fee;
    const p = poolResponses[key];
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }

    const poolApr = 0;
    pairs[key] = createPairStat(poolApr, key);
    const pair = pairs[key];
    pair.tvl = new BigNumber(uusd.amount)
      .times(depositAmount.balance)
      .times(2)
      .div(p.total_share)
      .toString();
    pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;

    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, key: string) {
      const poolInfo = poolInfos[key];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        poolAstroApr: 0,
        farmApr:  0,
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.farmService.query(this.farmContract, {
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  async getLPStat(poolResponse: PoolResponse, astroPrice: number) {
    const config = await this.wasm.query(this.terrajs.settings.astroportGenerator, {config: {}});
    const alloc_point = 18277;
    const astro_per_block = +config.tokens_per_block * (alloc_point / +config.total_alloc_point);
    const astro_total_emit_per_year = astro_per_block / 6.5 * 60 * 60 * 24 * 365.25;
    // const farmPoolUSTAmount = poolResponse.assets[1]?.info?.native_token?.['denom'] === Denom.USD ? poolResponse.assets[1].amount : poolResponse.assets[0].amount;
    const tvlStrategy38 = +(await this.wasm.query(this.terrajs.settings.apolloFactory, {
      get_strategy_tvl: {
        id: 38
      }
    })).tvl;
    const farmUSTTvl = tvlStrategy38; // +farmPoolUSTAmount * 2;
    // REMARK: not 100% same as Apollo FE
    const astroApr = astro_total_emit_per_year * +astroPrice / farmUSTTvl;
    const apr =  astroApr + await this.getApolloLPApr(poolResponse, tvlStrategy38);
    return {
      apr
    };
  }

  // REMARK: not 100% same as Apollo FE
  async getApolloLPApr(apolloPoolResponse: PoolResponse, tvlStrategy38: number): Promise<number>{
    const configTask = this.wasm.query(this.terrajs.settings.apolloFactory, {get_config: {}});
    const heightTask = this.terrajs.getHeight();
    const getStrategy38Task = this.wasm.query(this.terrajs.settings.apolloFactory, {
      get_strategy: {
        id: 38
      }
    });
    const getTotalRewardWeightTask = this.wasm.query(this.terrajs.settings.apolloFactory, {
      get_total_reward_weight: {}
    });

    // "apollo_reward_percentage": "0.2" ?
    const apolloPoolUSTAmount = apolloPoolResponse.assets[1]?.info?.native_token?.['denom'] === Denom.USD ? apolloPoolResponse.assets[1].amount : apolloPoolResponse.assets[0].amount;
    const apolloPoolApolloAmount = apolloPoolResponse.assets[1]?.info?.token ? apolloPoolResponse.assets[1].amount : apolloPoolResponse.assets[0].amount;
    const apolloPrice = div(apolloPoolUSTAmount, apolloPoolApolloAmount);
    // const apolloPrice = 1.36;
    const [config, height, strategy38, totalRewardWeight] = await Promise.all([configTask, heightTask, getStrategy38Task, getTotalRewardWeightTask]);
    const current_distribution_schedule = (config.distribution_schedule as []).find(obj => height >= +obj[0] && height <= +obj[1]);
    const totalMint = +current_distribution_schedule[2];
    // const blockPerYears = 365 * 24 * 3600 / 6.5;
    // const mintYearsDuration = (current_distribution_schedule[1] - current_distribution_schedule[0]) / blockPerYears;
    // const mintPerYear = totalMint / mintYearsDuration;

    const weight_ratio = new BigNumber(strategy38.reward_weight).dividedBy(totalRewardWeight.total_reward_weight);
    const AnnualApolloReward = new BigNumber(totalMint).div(current_distribution_schedule[1] - current_distribution_schedule[0]).multipliedBy(31556952).toNumber();
    const apolloAprInput = weight_ratio.multipliedBy(AnnualApolloReward).multipliedBy(apolloPrice).div(+tvlStrategy38).toNumber();

    // const c = new BigNumber(apolloPoolUSTAmount).multipliedBy(2).div(apolloPoolResponse.total_share);
    // const s = new BigNumber(strategy38.total_bond_amount).multipliedBy(c).multipliedBy(strategy38.reward_weight).dividedBy(totalRewardWeight.total_reward_weight);
    // const apr = new BigNumber(mintPerYear).multipliedBy(apolloPrice).div(s);
    // const test = apr.toNumber();
    return apolloAprInput;
  }
}
