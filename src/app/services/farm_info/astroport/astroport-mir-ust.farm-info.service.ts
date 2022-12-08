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
import {MsgExecuteContract} from '@terra-money/terra.js';
import {toBase64} from '../../../libs/base64';
import {PoolResponse} from '../../api/terraswap_pair/pool_response';
import {VaultsResponse} from '../../api/gov/vaults_response';
import {Denom} from '../../../consts/denom';
import {AstroportTokenUstFarmService} from '../../api/astroport-tokenust-farm.service';
import {WasmService} from '../../api/wasm.service';
import {PairInfo} from '../../api/terraswap_factory/pair_info';
import { div } from '../../../libs/math';
import { MirrorStakingService } from '../../api/mirror-staking.service';
import { BalancePipe } from '../../../pipes/balance.pipe';
import { Apollo, gql } from 'apollo-angular';

@Injectable()
export class AstroportMirUstFarmInfoService implements FarmInfoService {
  farm = 'Mirror';
  autoCompound = true;
  autoStake = true;
  farmColor = '#232C45';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Astroport';
  denomTokenContract = Denom.USD;
  highlight = false;
  mainnetOnly = true;
  hasProxyReward = true;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.mirrorToken;
  }

  constructor(
    private apollo: Apollo,
    private farmService: AstroportTokenUstFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService,
    private mirrorStaking: MirrorStakingService,
    private balancePipe: BalancePipe,
  ) {
  }

  get farmContract() {
    return this.terrajs.settings.astroportMirUstFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.mirrorToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.mirrorGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.farmService.query(this.farmContract, { pools: {} });
    return pool.pools;
  }

  // async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
  //   const key = `${this.dex}|${this.defaultBaseTokenContract}|${Denom.USD}`;
  //   const depositAmountTask = this.wasm.query(this.terrajs.settings.astroportGenerator, { deposit: { lp_token: pairInfos[key].liquidity_token, user: this.farmContract }});
  //   const farmConfigTask = this.farmService.query(this.farmContract, { config: {} });
  //
  //   // fire query
  //   const apollo = this.apollo.use(this.terrajs.settings.mirrorGraph);
  //   const mirrorGovStatTask = apollo.query<any>({
  //     query: gql`query statistic($network: Network) {
  //       statistic(network: $network) {
  //         govAPR
  //       }
  //     }`,
  //     variables: {
  //       network: 'TERRA'
  //     }
  //   }).toPromise();
  //
  //   const astroPrice = this.balancePipe.transform('1', poolResponses[`Astroport|${this.terrajs.settings.astroToken}|${Denom.USD}`]);
  //
  //   // action
  //   const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
  //   const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
  //   const lpStatTask =  this.getLPStat(poolResponses[key], +astroPrice);
  //   const pairs: Record<string, PairStat> = {};
  //   const [lpStat, mirrorGovStat, depositAmount, farmConfig] = await Promise.all([lpStatTask, mirrorGovStatTask, depositAmountTask, farmConfigTask]);
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
  //       farmApr: mirrorGovStat.data.statistic.govAPR,
  //       tvl: '0',
  //       multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
  //       vaultFee: 0,
  //     };
  //     return stat;
  //   }
  // }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const key = `${this.dex}|${this.defaultBaseTokenContract}|${Denom.USD}`;
    const depositAmountTask = this.wasm.query(this.terrajs.settings.astroportGenerator, { deposit: { lp_token: pairInfos[key].liquidity_token, user: this.farmContract }});
    const farmConfigTask = this.farmService.query(this.farmContract, { config: {} });
    const apollo = this.apollo.use(this.terrajs.settings.mirrorGraph);
    // const mirrorGovStatTask = apollo.query<any>({
    //   query: gql`query statistic($network: Network) {
    //     statistic(network: $network) {
    //       govAPR
    //     }
    //   }`,
    //   variables: {
    //     network: 'TERRA'
    //   }
    // }).toPromise();

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
    const pairs: Record<string, PairStat> = {};

    // const [mirrorGovStat, depositAmount, farmConfig] = await Promise.all([mirrorGovStatTask, depositAmountTask, farmConfigTask]);
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
      .times(depositAmount)
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
        farmApr: 0,
        // +(mirrorGovStat.data?.statistic?.govAPR || 0),
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

  getStakeGovMsg(amount: string): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.mirrorToken,
      {
        send: {
          contract: this.terrajs.settings.mirrorGov,
          amount,
          msg: toBase64({ stake_voting_tokens: {} })
        }
      }
    );
  }

  async getLPStat(poolResponse: PoolResponse, astroPrice: number) {
    const config = await this.wasm.query(this.terrajs.settings.astroportGenerator, {config: {}});
    const alloc_point = 33944;
    const astro_per_block = +config.tokens_per_block * (alloc_point / +config.total_alloc_point);
    const astro_total_emit_per_year = astro_per_block / 6.5 * 60 * 60 * 24 * 365;
    const farmPoolUSTAmount = poolResponse.assets[1]?.info?.native_token?.['denom'] === Denom.USD ? poolResponse.assets[1].amount : poolResponse.assets[0].amount;
    const farmUSTTvl = +farmPoolUSTAmount * 2;
    const apr = (astro_total_emit_per_year * +astroPrice / farmUSTTvl) + await this.getMirApr(poolResponse);
    return {
      apr
    };
  }

  async getMirApr(poolResponse: PoolResponse): Promise<number>{
    const stakingPoolInfoTask = this.mirrorStaking.query({
      pool_info: {
        asset_token: this.terrajs.settings.mirrorToken
      }
    });
    const distributionInfoTask = this.wasm.query(this.terrajs.settings.mirrorFactory, {distribution_info: {}});


    // got from apr.ts in Mirror dApp FE
    // genesis(2020-12-04 04:00 KST) + 6hours
    const START = 1607022000000 + 60000 * 60 * 6;
    const YEAR = 60000 * 60 * 24 * 365;

    const distributionSchedules = [
      [START, YEAR * 1 + START, '54900000000000'],
      [YEAR * 1 + START, YEAR * 2 + START, '27450000000000'],
      [YEAR * 2 + START, YEAR * 3 + START, '13725000000000'],
      [YEAR * 3 + START, YEAR * 4 + START, '6862500000000'],
    ];

    const now = Date.now();
    const current_distribution_schedule = distributionSchedules.find(
      (item) => now >= item[0] && now <= item[1]
    );


    const mirPoolUSTAmount = poolResponse.assets[1]?.info?.native_token?.['denom'] === Denom.USD ? poolResponse.assets[1].amount : poolResponse.assets[0].amount;
    const mirPoolMirAmount = poolResponse.assets[1]?.info?.token ? poolResponse.assets[1].amount : poolResponse.assets[0].amount;
    const mirPrice = div(mirPoolUSTAmount, mirPoolMirAmount);
    const [distributionInfo, stakingPoolInfo] = await Promise.all([distributionInfoTask, stakingPoolInfoTask]);
    const totalMint = +current_distribution_schedule[2];
    const mintPerYear = totalMint;
    const mirWeight = +distributionInfo.weights.find(item => item[0] === this.terrajs.settings.mirrorToken)[1];
    const totalWeight = distributionInfo.weights.reduce((previousValue, currentValue) => previousValue + currentValue[1], 0);

    const c = new BigNumber(mirPoolUSTAmount).multipliedBy(2).div(poolResponse.total_share);
    const s = new BigNumber(stakingPoolInfo.total_bond_amount).multipliedBy(c);
    const apr = new BigNumber(mintPerYear).multipliedBy(mirPrice).multipliedBy(mirWeight).div(totalWeight).div(s);
    return apr.toNumber();
  }
}
