import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { PoolItem } from '../../api/astroport_token_token_farm/pools_response';
import { RewardInfoResponseItem } from '../../api/astroport_token_token_farm/reward_info_response';
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
import {WasmService} from '../../api/wasm.service';
import {PairInfo} from '../../api/terraswap_factory/pair_info';
import {AstroportTokenTokenFarmService} from '../../api/astroport-tokentoken-farm.service';
import {Denom} from '../../../consts/denom';
import {times} from '../../../libs/math';
import {BalancePipe} from '../../../pipes/balance.pipe';
import {Apollo, gql} from 'apollo-angular';

@Injectable()
export class AstroportNlunaPsiFarmInfoService implements FarmInfoService {
  farm = 'Nexus';
  autoCompound = true;
  autoStake = true;
  farmColor = '#F4B6C7';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Astroport';
  denomTokenContract = this.terrajs.settings.nexusToken;
  highlight = true;
  mainnetOnly = true;
  hasProxyReward = true;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.nLunaToken;
  }

  constructor(
    private farmService: AstroportTokenTokenFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService,
    private balancePipe: BalancePipe,
    private apollo: Apollo,
  ) {
  }

  get farmContract() {
    return this.terrajs.settings.astroportNlunaPsiFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.nexusToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.nexusGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.farmService.query(this.farmContract, { pools: {} });
    return pool.pools;
  }

  // async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
  //   const key = `${this.dex}|${this.defaultBaseTokenContract}|${this.denomTokenContract}`;
  //   const depositAmountTask = this.wasm.query(this.terrajs.settings.astroportGenerator, { deposit: { lp_token: pairInfos[key].liquidity_token, user: this.farmContract }});
  //   const farmConfigTask = this.farmService.query(this.farmContract, { config: {} });
  //   const astroPrice = this.balancePipe.transform('1', poolResponses[`Astroport|${this.terrajs.settings.astroToken}|${Denom.USD}`]);
  //   const psiPrice = this.balancePipe.transform('1', poolResponses[`Astroport|${this.terrajs.settings.nexusToken}|${Denom.USD}`]);
  //
  //   const apollo = this.apollo.use(this.terrajs.settings.nexusGraph);
  //   const nexusLPStatTask = apollo.query<any>({
  //     query: gql`{
  //       getLiquidityPoolAprV2 {
  //         astroport {
  //           psiNLunaLpArp
  //         }
  //       }
  //     }`
  //   }).toPromise();
  //
  //   const nexusGovStatTask = apollo.query<any>({
  //     query: gql`{
  //       getGovStakingAprRecords(limit: 1, offset: 0) {
  //         date
  //         govStakingApr
  //       }
  //     }`
  //   }).toPromise();
  //
  //   // action
  //   const nexusLpApr = +((await nexusLPStatTask).data.getLiquidityPoolAprV2.astroport.psiNLunaLpArp);
  //   const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
  //   const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
  //   const astroAprTask = this.getAstroAprTask(poolResponses[key], astroPrice, psiPrice);
  //   const pairs: Record<string, PairStat> = {};
  //
  //   const [depositAmount, farmConfig, astroApr, nexusGovStat] = await Promise.all([depositAmountTask, farmConfigTask, astroAprTask, nexusGovStatTask]);
  //   const communityFeeRate = +farmConfig.community_fee;
  //   const p = poolResponses[key];
  //   const psiAsset = p.assets.find(a => a.info.token?.['contract_addr'] === this.terrajs.settings.nexusToken);
  //   if (!psiAsset) {
  //     return;
  //   }
  //
  //   const totalPsiValueUST = times(psiPrice, psiAsset.amount);
  //   const nLunaPsiTvl = new BigNumber(totalPsiValueUST)
  //     .times(depositAmount)
  //     .times(2)
  //     .div(p.total_share)
  //     .toString();
  //
  //   const poolApr = (+nexusLpApr / 100 || 0);
  //   pairs[key] = createPairStat(poolApr, key);
  //   const pair = pairs[key];
  //   pair.tvl = nLunaPsiTvl;
  //   pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;
  //
  //   return pairs;
  //
  //   // tslint:disable-next-line:no-shadowed-variable
  //   function createPairStat(poolApr: number, key: string) {
  //     const poolInfo = poolInfos[key];
  //     const stat: PairStat = {
  //       poolApr,
  //       poolAstroApr: +(astroApr.apr || 0),
  //       poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
  //       farmApr: nexusGovStat.data.getGovStakingAprRecords[0].govStakingApr / 100,
  //       tvl: '0',
  //       multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
  //       vaultFee: 0,
  //     };
  //     return stat;
  //   }
  // }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const key = `${this.dex}|${this.defaultBaseTokenContract}|${this.denomTokenContract}`;
    const depositAmountTask = this.wasm.query(this.terrajs.settings.astroportGenerator, { deposit: { lp_token: pairInfos[key].liquidity_token, user: this.farmContract }});
    const farmConfigTask = this.farmService.query(this.farmContract, { config: {} });
    const psiPrice = this.balancePipe.transform('1', poolResponses[`Astroport|${this.terrajs.settings.nexusToken}|${Denom.USD}`]);
    const apollo = this.apollo.use(this.terrajs.settings.nexusGraph);
    const nexusGovStatTask = apollo.query<any>({
      query: gql`{
        getGovStakingAprRecords(limit: 1, offset: 0) {
          date
          govStakingApr
        }
      }`
    }).toPromise();

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
    const pairs: Record<string, PairStat> = {};

    const [depositAmount, farmConfig, nexusGovStat] = await Promise.all([depositAmountTask, farmConfigTask, nexusGovStatTask]);
    const communityFeeRate = +farmConfig.community_fee;
    const p = poolResponses[key];
    const psiAsset = p.assets.find(a => a.info.token?.['contract_addr'] === this.terrajs.settings.nexusToken);
    if (!psiAsset) {
      return;
    }

    const totalPsiValueUST = times(psiPrice, psiAsset.amount);
    const nLunaPsiTvl = new BigNumber(totalPsiValueUST)
      .times(depositAmount)
      .times(2)
      .div(p.total_share)
      .toString();

    const poolApr = 0;
    pairs[key] = createPairStat(poolApr, key);
    const pair = pairs[key];
    pair.tvl = nLunaPsiTvl;
    pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;

    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, key: string) {
      const poolInfo = poolInfos[key];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        farmApr: nexusGovStat.data.getGovStakingAprRecords[0].govStakingApr / 100,
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
      this.terrajs.settings.nexusToken,
      {
        send: {
          contract: this.terrajs.settings.nexusGov,
          amount,
          msg: toBase64({ stake_voting_tokens: {} })
        }
      }
    );
  }

  async getAstroAprTask(poolResponse: PoolResponse, astroPrice: string, psiPrice: string) {
    const config = await this.wasm.query(this.terrajs.settings.astroportGenerator, {config: {}});
    const alloc_point = 18277;
    const astro_per_block = +config.tokens_per_block * (alloc_point / +config.total_alloc_point);
    const astro_total_emit_per_year = astro_per_block / 6.5 * 60 * 60 * 24 * 365;
    const farmPoolPsiAmount = poolResponse.assets[1]?.info?.token?.['contract_addr'] === this.terrajs.settings.nexusToken ? poolResponse.assets[1].amount : poolResponse.assets[0].amount;
    const farmUSTTvl = +farmPoolPsiAmount * +psiPrice * 2;
    const apr = (astro_total_emit_per_year * +astroPrice / farmUSTTvl);
    return {
      apr
    };
  }

}
