import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import { GovService } from '../api/gov.service';
import { MirrorFarmService } from '../api/mirror-farm.service';
import { MirrorStakingService } from '../api/mirror-staking.service';
import { RewardInfoResponseItem } from '../api/mirror_farm/reward_info_response';
import { TerraSwapService } from '../api/terraswap.service';
import { PairInfo } from '../api/terraswap_factory/pair_info';
import { TerrajsService } from '../terrajs.service';
import { FarmInfoService, PairStat, PoolInfo, PoolItem } from './farm-info.service';

@Injectable()
export class MirrorFarmInfoService implements FarmInfoService {

  farmName = 'Mirror';

  constructor(
    private apollo: Apollo,
    private gov: GovService,
    private mirrorFarm: MirrorFarmService,
    private mirrorStaking: MirrorStakingService,
    private terrajs: TerrajsService,
    private terraSwap: TerraSwapService,
  ) { }

  async queryPoolItems(): Promise<PoolItem[]> {
    const res = await this.mirrorFarm.query({ pools: {} });
    return res.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
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
    const govVaults = await this.gov.vaults();
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.mirrorFarm)?.weight || 0;
    const mirrorGovStat = await mirrorGovStatTask;
    const pairs: Record<string, PairStat> = {};
    for (const asset of mirrorStat.data.assets) {
      const poolApr = +(asset.statistic.apr?.long || 0);
      pairs[asset.token] = createPairStat(poolApr, asset.token);
    }

    const rewardInfos = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const govConfig = await this.gov.config();
    const communityFeeRate = +farmConfig.community_fee * (1 - +govConfig.warchest_ratio);
    const tasks = rewardInfos.reward_infos.map(async it => {
      const p = await this.terraSwap.query(pairInfos[it.asset_token].contract_addr, { pool: {} });
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
        poolApy: (poolApr / 365 + 1) ** 365 - 1,
        farmApr: mirrorGovStat.data.statistic.govAPR,
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const height = await this.terrajs.getHeight();
    const rewardInfo = await this.mirrorFarm.query({
      reward_info: {
        staker_addr: this.terrajs.address,
        height,
      }
    });
    return rewardInfo.reward_infos;
  }

}
