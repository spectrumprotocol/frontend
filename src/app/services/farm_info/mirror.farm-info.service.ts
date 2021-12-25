import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import { MirrorFarmService } from '../api/mirror-farm.service';
import { MirrorStakingService } from '../api/mirror-staking.service';
import { RewardInfoResponseItem } from '../api/mirror_farm/reward_info_response';
import { TerrajsService } from '../terrajs.service';
import {
  DEX, FARM_TYPE_ENUM,
  FarmInfoService,
  PairStat,
  PoolInfo,
  PoolItem
} from './farm-info.service';
import {MsgExecuteContract} from '@terra-money/terra.js';
import {toBase64} from '../../libs/base64';
import { PoolResponse } from '../api/terraswap_pair/pool_response';
import { VaultsResponse } from '../api/gov/vaults_response';
import {Denom} from '../../consts/denom';

@Injectable()
export class MirrorFarmInfoService implements FarmInfoService {

  farm = 'Mirror';
  autoCompound = true;
  autoStake = true;
  farmColor = '#232C45';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'TERRASWAP';

  getDenomTokenContractOrNative(baseToken?: string){
    return Denom.USD;
  }

  constructor(
    private apollo: Apollo,
    private mirrorFarm: MirrorFarmService,
    private mirrorStaking: MirrorStakingService,
    private terrajs: TerrajsService,
  ) { }

  get farmContract() {
    return this.terrajs.settings.mirrorFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.mirrorToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.mirrorGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const res = await this.mirrorFarm.query({ pools: {} });
    return res.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse): Promise<Record<string, PairStat>> {
    // fire query
    const rewardInfoTask = this.mirrorStaking.query({
      reward_info: {
        staker_addr: this.terrajs.settings.mirrorFarm
      }
    });
    const farmConfigTask = this.mirrorFarm.query({ config: {} });
    const apollo = this.apollo.use(this.terrajs.settings.mirrorGraph);
    const mirrorGovStatTask = apollo.query<any>({
      query: gql`query statistic($network: Network) {
        statistic(network: $network) {
          govAPR
        }
      }`,
      variables: {
        network: 'TERRA'
      }
    }).toPromise();

    const mirrorStat = await apollo.query<any>({
      query: gql`query assets {
        assets {
          token
          statistic {
            apr { long }
          }
        }
      }`
    }).toPromise();

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.mirrorFarm)?.weight || 0;
    const mirrorGovStat = await mirrorGovStatTask;
    const pairs: Record<string, PairStat> = {};
    for (const asset of mirrorStat.data.assets) {
      const poolApr = +(asset.statistic.apr?.long || 0);
      pairs[asset.token] = createPairStat(poolApr, asset.token);
    }

    const rewardInfos = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const communityFeeRate = +farmConfig.community_fee;
    const tasks = rewardInfos.reward_infos.map(async it => {
      const p = poolResponses[this.dex + '|' + it.asset_token + '|' + Denom.USD];
      const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
      if (!uusd) {
        return;
      }
      const pair = (pairs[it.asset_token] || (pairs[it.asset_token] = createPairStat(0, it.asset_token)));
      const value = new BigNumber(uusd.amount)
        .times(it.bond_amount)
        .times(2)
        .div(p.total_share)
        .toString();
      pair.tvl = value;
      pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;
    });
    await Promise.all(tasks);

    return pairs;

    function createPairStat(poolApr: number, token: string) {
      const poolInfo = poolInfos[token];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        farmApr: mirrorGovStat.data.statistic.govAPR,
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.mirrorFarm.query({
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
          msg: toBase64({stake_voting_tokens: {}})
        }
      }
    );
  }
}
