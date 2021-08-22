import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { PylonFarmService } from '../api/pylon-farm.service';
import { PylonStakingService } from '../api/pylon-staking.service';
import { PoolItem } from '../api/pylon_farm/pools_response';
import { RewardInfoResponseItem } from '../api/pylon_farm/reward_info_response';
import { GovService } from '../api/gov.service';
import { TerraSwapService } from '../api/terraswap.service';
import { PairInfo } from '../api/terraswap_factory/pair_info';
import { TerrajsService } from '../terrajs.service';
import { FarmInfoService, PairStat, PoolInfo } from './farm-info.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PylonFarmInfoService implements FarmInfoService {
  farm = 'Pylon';
  tokenSymbol = 'MINE';

  constructor(
    private gov: GovService,
    private pylonFarm: PylonFarmService,
    private terrajs: TerrajsService,
    private terraSwap: TerraSwapService,
    private pylonStaking: PylonStakingService,
    private httpClient: HttpClient
  ) { }

  get farmContract() {
    return this.terrajs.settings.pylonFarm;
  }

  get farmTokenContract() {
    return this.terrajs.settings.pylonToken;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.pylonFarm.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const height = await this.terrajs.getHeight();
    const rewardInfoTask = this.pylonStaking.query({staker_info: {block_height: +height, staker: this.terrajs.settings.pylonFarm}});
    const farmConfigTask = this.pylonFarm.query({ config: {} });

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govVaults = await this.gov.vaults();
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.pylonFarm)?.weight || 0;
    const pylonLPStat = await firstValueFrom(this.httpClient.get<any>(`${this.terrajs.settings.pylonAPI}/api/liquidity/v1/overview`));
    const pylonGovStat = await firstValueFrom(this.httpClient.get<any>(`${this.terrajs.settings.pylonAPI}/api/governance/v1/overview`));
    const pairs: Record<string, PairStat> = {};

    const poolApr = +(pylonLPStat.apy || 0);
    pairs[this.terrajs.settings.pylonToken] = createPairStat(poolApr, this.terrajs.settings.pylonToken);

    const rewardInfo = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const govConfig = await this.gov.config();
    const communityFeeRate = +farmConfig.community_fee * (1 - +govConfig.warchest_ratio);
    const p = await this.terraSwap.query(pairInfos[this.terrajs.settings.pylonToken].contract_addr, { pool: {} });
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }
    const pair = pairs[this.terrajs.settings.pylonToken];
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
        farmApr: +(pylonGovStat.apy || 0),
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const height = await this.terrajs.getHeight();
    const rewardInfo = await this.pylonFarm.query({
      reward_info: {
        staker_addr: this.terrajs.address,
        height: +height,
      }
    });
    return rewardInfo.reward_infos;
  }

}
