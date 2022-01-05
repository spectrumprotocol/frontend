import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import { TerrajsService } from '../terrajs.service';
import {
  DEX,
  FARM_TYPE_ENUM,
  FarmInfoService,
  PairStat,
  PoolInfo,
  PoolItem
} from './farm-info.service';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { toBase64 } from '../../libs/base64';
import { PoolResponse } from '../api/terraswap_pair/pool_response';
import { div, times } from '../../libs/math';
import { RewardInfoResponseItem } from '../api/nexus_nassets_psi_farm/reward_info_response';
import { NlunaPsiFarmService } from '../api/nluna-psi-farm.service';
import { NlunaPsiStakingService } from '../api/nluna-psi-staking.service';
import { BalancePipe } from '../../pipes/balance.pipe';
import { VaultsResponse } from '../api/gov/vaults_response';
import { Denom } from '../../consts/denom';
import {PairInfo} from '../api/terraswap_factory/pair_info';

@Injectable()
export class NlunaPsiFarmInfoService implements FarmInfoService {
  farm = 'Nexus';
  autoCompound = true;
  autoStake = true;
  farmColor = '#F4B6C7';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Terraswap';
  denomTokenContract = Denom.USD;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.nLunaToken;
  }

  constructor(
    private nlunaPsiFarmService: NlunaPsiFarmService,
    private terrajs: TerrajsService,
    private apollo: Apollo,
    private nlunaPsiStakingService: NlunaPsiStakingService,
    private balancePipe: BalancePipe
  ) { }

  get farmContract() {
    return this.terrajs.settings.nLunaPsiFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.nexusToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.nexusGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.nlunaPsiFarmService.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const apollo = this.apollo.use(this.terrajs.settings.nexusGraph);
    const nexusLPStatTask = apollo.query<any>({
      query: gql`{
        getLiquidityPoolApr {
          psiNLunaLpArp
        }
      }`
    }).toPromise();
    const nexusGovStatTask = apollo.query<any>({
      query: gql`{
        getGovStakingAprRecords(limit: 1, offset: 0) {
          date
          govStakingApr
        }
      }`
    }).toPromise();

    const unixTimeSecond = Math.floor(Date.now() / 1000);
    const rewardInfoTask = this.nlunaPsiStakingService.query({ staker_info: { time_seconds: +unixTimeSecond, staker: this.terrajs.settings.nLunaPsiFarm } });
    const farmConfigTask = this.nlunaPsiFarmService.query({ config: {} });

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.nLunaPsiFarm)?.weight || 0;
    const nexusLPStat = await nexusLPStatTask;
    const nexusGovStat = await nexusGovStatTask;
    const pairs: Record<string, PairStat> = {};

    const rewardInfo = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const communityFeeRate = +farmConfig.community_fee;
    const key = `${this.dex}|${this.terrajs.settings.nLunaToken}|${this.terrajs.settings.nexusToken}`;

    const p = poolResponses[key];
    const psiAsset = p.assets.find(a => a.info.token?.['contract_addr'] === this.terrajs.settings.nexusToken);
    if (!psiAsset) {
      return;
    }
    const psiPrice = this.balancePipe.transform('1', poolResponses[`${this.dex}|${this.terrajs.settings.nexusToken}|${Denom.USD}`]);
    const totalPsiValueUST = times(psiPrice, psiAsset.amount);
    const nLunaPsiTvl = new BigNumber(totalPsiValueUST)
      .times(rewardInfo.bond_amount)
      .times(2)
      .div(p.total_share)
      .toString();

    const poolApr = +(nexusLPStat.data.getLiquidityPoolApr.psiNLunaLpArp || 0) / 100;
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
    const rewardInfo = await this.nlunaPsiFarmService.query({
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

  async getnLunaPsiLPStat(nLunaPsiPoolResponse: PoolResponse, unixTimeSecond) {
    const configTask = this.nlunaPsiStakingService.query({ config: {} });
    const stateTask = this.nlunaPsiStakingService.query({ state: { time_seconds: +unixTimeSecond } });
    const [config, state] = await Promise.all([configTask, stateTask]);
    const poolnLunaAmount = nLunaPsiPoolResponse.assets[0]?.info?.token['contract_addr'] === this.terrajs.settings.nLunaToken ? nLunaPsiPoolResponse.assets[0].amount : nLunaPsiPoolResponse.assets[1].amount;
    const poolPsiAmount = nLunaPsiPoolResponse.assets[0]?.info?.token['contract_addr'] === this.terrajs.settings.nexusToken ? nLunaPsiPoolResponse.assets[0].amount : nLunaPsiPoolResponse.assets[1].amount;
    const nLunaPerPsiPrice = div(poolnLunaAmount, poolPsiAmount);
    const current_distribution_schedule = config.distribution_schedule.find(obj => unixTimeSecond >= +obj.start_time && unixTimeSecond <= +obj.end_time);
    if (!current_distribution_schedule) {
      return {
        apr: 0
      };
    }
    const totalMint = +current_distribution_schedule.amount;
    const c = new BigNumber(poolnLunaAmount).multipliedBy(2).div(nLunaPsiPoolResponse.total_share);
    const s = new BigNumber(state.total_bond_amount).multipliedBy(c);
    const apr = new BigNumber(totalMint).multipliedBy(nLunaPerPsiPrice).div(s);
    return {
      apr,
    };
  }
}
