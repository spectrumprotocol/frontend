import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { PylonFarmService } from '../api/pylon-farm.service';
import { PylonStakingService } from '../api/pylon-staking.service';
import { PoolItem } from '../api/pylon_farm/pools_response';
import { RewardInfoResponseItem } from '../api/pylon_farm/reward_info_response';
import { TerrajsService } from '../terrajs.service';
import {
  DEX,
  FARM_TYPE_ENUM,
  FarmInfoService,
  PairStat,
  PoolInfo
} from './farm-info.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { toBase64 } from '../../libs/base64';
import { PoolResponse } from '../api/terraswap_pair/pool_response';
import { VaultsResponse } from '../api/gov/vaults_response';
import { Denom } from '../../consts/denom';
import {PairInfo} from '../api/terraswap_factory/pair_info';

@Injectable()
export class PylonFarmInfoService implements FarmInfoService {
  farm = 'Pylon';
  autoCompound = true;
  autoStake = true;
  govLock = true;
  farmColor = '#00cfda';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Terraswap';
  denomTokenContract = Denom.USD;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.pylonToken;
  }

  constructor(
    private pylonFarm: PylonFarmService,
    private terrajs: TerrajsService,
    private pylonStaking: PylonStakingService,
    private httpClient: HttpClient
  ) { }

  get farmContract() {
    return this.terrajs.settings.pylonFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.pylonToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.pylonGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.pylonFarm.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const height = await this.terrajs.getHeight();
    const rewardInfoTask = this.pylonStaking.query({ staker_info: { block_height: +height, staker: this.terrajs.settings.pylonFarm } });
    const farmConfigTask = this.pylonFarm.query({ config: {} });

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.pylonFarm)?.weight || 0;
    // const pylonLPStat = await firstValueFrom(this.httpClient.get<any>(`${this.terrajs.settings.pylonAPI}/api/liquidity/v1/overview`));
    // const pylonGovStat = await firstValueFrom(this.httpClient.get<any>(`${this.terrajs.settings.pylonAPI}/api/governance/v1/overview`));
    const pairs: Record<string, PairStat> = {};

    const poolApr = 0;
    const key = `${this.dex}|${this.terrajs.settings.pylonToken}|${Denom.USD}`;

    pairs[key] = createPairStat(poolApr, key);

    const rewardInfo = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const communityFeeRate = +farmConfig.community_fee;
    const p = poolResponses[key];
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }
    const pair = pairs[key];
    const value = new BigNumber(uusd.amount)
      .times(rewardInfo.bond_amount)
      .times(2)
      .div(p.total_share)
      .toString();
    pair.tvl = value;
    pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;

    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, key: string) {
      const poolInfo = poolInfos[key];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        farmApr: 0, // +(pylonGovStat.apy || 0),
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.pylonFarm.query({
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  getStakeGovMsg(amount: string): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.pylonToken,
      {
        send: {
          contract: this.terrajs.settings.pylonGov,
          amount,
          msg: toBase64({ stake: {} })
        }
      }
    );
  }
}
