import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { GovService } from '../api/gov.service';
import { SpecFarmService } from '../api/spec-farm.service';
import { TerraSwapService } from '../api/terraswap.service';
import { PairInfo } from '../api/terraswap_factory/pair_info';
import { TerrajsService } from '../terrajs.service';
import { FarmInfoService, PairStat, PoolInfo, PoolItem, RewardInfoResponseItem } from './farm-info.service';
import {MsgExecuteContract} from '@terra-money/terra.js';
import {toBase64} from '../../libs/base64';

@Injectable()
export class SpecFarmInfoService implements FarmInfoService {
  farm = 'Spectrum';
  tokenSymbol = 'SPEC';

  constructor(
    private gov: GovService,
    private specFarm: SpecFarmService,
    private terrajs: TerrajsService,
    private terraSwap: TerraSwapService,
  ) { }

  get farmContract() {
    return this.terrajs.settings.specFarm;
  }

  get farmTokenContract() {
    return this.terrajs.settings.specToken;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.specFarm.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govVaults = await this.gov.vaults();
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.specFarm)?.weight || 0;

    const pairs: Record<string, PairStat> = {};
    const tasks = Object.keys(poolInfos).map(async key => {
      const pairInfo = pairInfos[key];
      const poolInfo = poolInfos[key];
      const p = await this.terraSwap.query(pairInfo.contract_addr, { pool: {} });
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
    const height = await this.terrajs.getHeight();
    const rewardInfo = await this.specFarm.query({
      reward_info: {
        staker_addr: this.terrajs.address,
        height,
      }
    });
    for (const it of rewardInfo.reward_infos) {
      it['stake_bond_amount'] = it.bond_amount;
    }
    return rewardInfo.reward_infos;
  }

  getStakeGovMsg(amount: string): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.specToken,
      {
        send: {
          contract: this.terrajs.settings.gov,
          amount,
          msg: toBase64({stake_tokens: {}})
        }
      }
    );
  }

}
