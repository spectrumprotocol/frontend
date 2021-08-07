import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import { AnchorFarmService } from '../api/anchor-farm.service';
import { AnchorStakingService } from '../api/anchor-staking.service';
import { PoolItem } from '../api/anchor_farm/pools_response';
import { RewardInfoResponseItem } from '../api/anchor_farm/reward_info_response';
import { GovService } from '../api/gov.service';
import { TerraSwapService } from '../api/terraswap.service';
import { PairInfo } from '../api/terraswap_factory/pair_info';
import { TerrajsService } from '../terrajs.service';
import { FarmInfoService, PairStat, PoolInfo } from './farm-info.service';

@Injectable()
export class AnchorFarmInfoService implements FarmInfoService {
  farmName = 'Anchor';
  tokenSymbol = 'ANC';

  constructor(
    private gov: GovService,
    private anchorFarm: AnchorFarmService,
    private terrajs: TerrajsService,
    private terraSwap: TerraSwapService,
    private anchorStaking: AnchorStakingService,
    private apollo: Apollo
  ) { }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.anchorFarm.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const height = await this.terrajs.getHeight();
    const rewardInfoTask = this.anchorStaking.query({staker_info: {block_height: +height, staker: this.terrajs.settings.anchorFarm}});
    const farmConfigTask = this.anchorFarm.query({ config: {} });
    const apollo = this.apollo.use(this.terrajs.settings.anchorGraph);
    const anchorStatTask = apollo.query<any>({
      query: gql`query {
        borrowerDistributionAPYs: AnchorBorrowerDistributionAPYs(
          Order: DESC
          Limit: 1
        ) {
          Height
          Timestamp
          DistributionAPY
        }
        govRewards: AnchorGovRewardRecords(Order: DESC, Limit: 1) {
          CurrentAPY
          Timestamp
          Height
        }
        lpRewards: AnchorLPRewards(Order: DESC, Limit: 1) {
          Height
          Timestamp
          APY
        }
      }`
    }).toPromise();

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govVaults = await this.gov.vaults();
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.anchorFarm)?.weight || 0;
    const anchorStat = await anchorStatTask;
    const pairs: Record<string, PairStat> = {};

    const poolApr = +(anchorStat.data.lpRewards[0].APY || 0);
    pairs[this.terrajs.settings.anchorToken] = createPairStat(poolApr, this.terrajs.settings.anchorToken);

    const rewardInfo = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const govConfig = await this.gov.config();
    const communityFeeRate = +farmConfig.community_fee * (1 - +govConfig.warchest_ratio);
    const p = await this.terraSwap.query(pairInfos[this.terrajs.settings.anchorToken].contract_addr, { pool: {} });
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }
    const pair = pairs[this.terrajs.settings.anchorToken];
    const value = new BigNumber(uusd.amount)
      .times(rewardInfo.bond_amount)
      .times(2)
      .div(p.total_share)
      .toString();
    pair.tvl = value;
    pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;

    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, token: string) {
      const poolInfo = poolInfos[token];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 365 + 1) ** 365 - 1,
        farmApr: anchorStat.data.govRewards[0].CurrentAPY,
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const height = await this.terrajs.getHeight(true);
    const rewardInfo = await this.anchorFarm.query({
      reward_info: {
        staker_addr: this.terrajs.address,
        height: +height + 2,
      }
    });
    return rewardInfo.reward_infos;
  }

}
