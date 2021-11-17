import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { OrionFarmService } from '../api/orion-farm.service';
import { OrionStakingService } from '../api/orion-staking.service';
import { PoolItem } from '../api/orion_farm/pools_response';
import { RewardInfoResponseItem } from '../api/orion_farm/reward_info_response';
import { GovService } from '../api/gov.service';
import { TerrajsService } from '../terrajs.service';
import { FarmInfoService, PairStat, PoolInfo } from './farm-info.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { PoolResponse } from '../api/terraswap_pair/pool_response';

@Injectable()
export class OrionFarmInfoService implements FarmInfoService {
  farm = 'Orion';
  tokenSymbol = 'ORION';
  autoCompound = true;
  autoStake = false;
  farmColor = '#00BE72';
  auditWarning = false;
  pairSymbol = 'UST';

  constructor(
    private gov: GovService,
    private orionFarm: OrionFarmService,
    private terrajs: TerrajsService,
    private orionStaking: OrionStakingService,
    private httpClient: HttpClient
  ) { }

  get farmContract() {
    return this.terrajs.settings.orionFarm;
  }

  get farmTokenContract() {
    return this.terrajs.settings.orionToken;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.orionFarm.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>): Promise<Record<string, PairStat>> {
    const unixTimeSecond = Math.floor(Date.now() / 1000);
    const rewardInfoTask = this.orionStaking.query({ staker_info: { timestamp: +unixTimeSecond, staker: this.terrajs.settings.orionFarm } });
    const farmConfigTask = this.orionFarm.query({ config: {} });

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govVaults = await this.gov.vaults();
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.orionFarm)?.weight || 0;
    const orionLPStat = await firstValueFrom(this.httpClient.get<any>(`${this.terrajs.settings.orionAPI}/staking`));
    const pairs: Record<string, PairStat> = {};

    const poolApr = +orionLPStat?.lp?.apr / 100 || 0;
    pairs[this.terrajs.settings.orionToken] = createPairStat(poolApr, this.terrajs.settings.orionToken);

    const rewardInfo = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const communityFeeRate = +farmConfig.community_fee;
    const p = poolResponses[this.terrajs.settings.orionToken];
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }
    const pair = pairs[this.terrajs.settings.orionToken];
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
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        farmApr: 0,
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.orionFarm.query({
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  get farmGovContract() {
    return this.terrajs.settings.orionGov;
  }

}
