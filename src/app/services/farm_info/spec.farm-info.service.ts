import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { SpecFarmService } from '../api/spec-farm.service';
import { TerrajsService } from '../terrajs.service';
import {
  DEX,
  FARM_TYPE_ENUM,
  FarmInfoService,
  PairStat,
  PoolInfo,
  PoolItem,
  RewardInfoResponseItem
} from './farm-info.service';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { toBase64 } from '../../libs/base64';
import { PoolResponse } from '../api/terraswap_pair/pool_response';
import { VaultsResponse } from '../api/gov/vaults_response';
import { Denom } from '../../consts/denom';

@Injectable()
export class SpecFarmInfoService implements FarmInfoService {
  farm = 'Spectrum';
  autoCompound = false;
  autoStake = true;
  farmColor = '#fc5185';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Terraswap';
  denomTokenContract = Denom.USD;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.specToken;
  }

  constructor(
    private specFarm: SpecFarmService,
    private terrajs: TerrajsService,
  ) { }

  get farmContract() {
    return this.terrajs.settings.specFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.specToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.gov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.specFarm.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse): Promise<Record<string, PairStat>> {
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.specFarm)?.weight || 0;

    const pairs: Record<string, PairStat> = {};
    const tasks = Object.keys(poolInfos).map(async key => {
      const poolInfo = poolInfos[key];
      const p = poolResponses[key];
      const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
      if (!uusd) {
        return;
      }
      const value = new BigNumber(uusd.amount)
        .times(poolInfo.total_bond_amount as string)
        .times(2)
        .div(p.total_share)
        .toString();
      pairs[key] = {
        poolApr: 0,
        poolApy: 0,
        farmApr: 0,
        tvl: value,
        multiplier: govWeight * poolInfo.weight / totalWeight,
        vaultFee: 0,
      };
    });
    await Promise.all(tasks);
    return pairs;
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.specFarm.query({
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    for (const it of rewardInfo.reward_infos) {
      it['stake_bond_amount'] = it.bond_amount;
    }
    return rewardInfo.reward_infos;
  }

  getStakeGovMsg(amount: string, additionalData: object): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.specToken,
      {
        send: {
          contract: this.terrajs.settings.gov,
          amount,
          msg: toBase64({ stake_tokens: additionalData })
        }
      }
    );
  }
}
