import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { TerraworldFarmService } from '../api/terraworld-farm.service';
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
import { WasmService } from '../api/wasm.service';
import { div } from '../../libs/math';
import { Denom } from '../../consts/denom';
import { VaultsResponse } from '../api/gov/vaults_response';
import {PairInfo} from '../api/terraswap_factory/pair_info';

@Injectable()
export class TerraworldFarmInfoService implements FarmInfoService {
  farm = 'Terraworld';
  autoCompound = true;
  autoStake = true;
  auditWarning = true;
  farmColor = '#249fd4';
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Terraswap';
  denomTokenContract = Denom.USD;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.terraworldToken;
  }

  constructor(
    private terraworldFarm: TerraworldFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService
  ) { }

  get farmContract() {
    return this.terrajs.settings.terraworldFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.terraworldToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.terraworldGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.terraworldFarm.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const height = await this.terrajs.getHeight();
    const rewardInfoTask = this.wasm.query(this.terrajs.settings.terraworldStaking, { staker_info: { block_height: +height, staker: this.terrajs.settings.terraworldFarm } });
    const farmConfigTask = this.terraworldFarm.query({ config: {} });

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.terraworldFarm)?.weight || 0;
    const key = `${this.dex}|${this.terrajs.settings.terraworldToken}|${Denom.USD}`;
    const terraworldLPStat = await this.getTerraworldLPStat(poolResponses[key]);
    const terraworldGovStat = await this.getTerraworldGovStat();
    const pairs: Record<string, PairStat> = {};

    const rewardInfo = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const communityFeeRate = +farmConfig.community_fee;
    const p = poolResponses[key];
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }
    const specTwdTvl = new BigNumber(uusd.amount)
      .times(rewardInfo.bond_amount)
      .times(2)
      .div(p.total_share)
      .toString();

    const poolApr = +(terraworldLPStat.apr || 0);
    pairs[key] = createPairStat(poolApr, key);
    const pair = pairs[key];
    pair.tvl = specTwdTvl;
    pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;

    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, key: string) {
      const poolInfo = poolInfos[key];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        farmApr: +(terraworldGovStat.apy || 0),
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.terraworldFarm.query({
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  getStakeGovMsg(amount: string): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.terraworldToken,
      {
        send: {
          contract: this.terrajs.settings.terraworldGov,
          amount,
          msg: toBase64({ bond: {} })
        }
      }
    );
  }

  async getTerraworldLPStat(twdPoolResponse: PoolResponse) {
    const height = await this.terrajs.getHeight();
    const configTask = this.wasm.query(this.terrajs.settings.terraworldStaking, { config: {} });
    const stateTask = this.wasm.query(this.terrajs.settings.terraworldStaking, { state: { block_height: height } });
    const [config, state] = await Promise.all([configTask, stateTask]);
    const twdPoolUSTAmount = twdPoolResponse.assets[1]?.info?.native_token?.['denom'] === Denom.USD ? twdPoolResponse.assets[1].amount : twdPoolResponse.assets[0].amount;
    const twdPoolTWDAmount = twdPoolResponse.assets[1]?.info?.token ? twdPoolResponse.assets[1].amount : twdPoolResponse.assets[0].amount;
    const twdPrice = div(twdPoolUSTAmount, twdPoolTWDAmount);
    const current_distribution_schedule = (config.distribution_schedule as []).find(obj => height >= +obj[0] && height <= +obj[1]);
    const totalMint = +current_distribution_schedule[2];
    const c = new BigNumber(twdPoolUSTAmount).multipliedBy(2).div(twdPoolResponse.total_share);
    const s = new BigNumber(state.total_bond_amount).multipliedBy(c);
    const apr = new BigNumber(totalMint).multipliedBy(twdPrice).div(s);
    return {
      apr,
    };
  }

  async getTerraworldGovStat() {
    const height = await this.terrajs.getHeight();
    const configTask = this.wasm.query(this.terrajs.settings.terraworldGov, { config: {} });
    const stateTask = this.wasm.query(this.terrajs.settings.terraworldGov, { state: { block_height: height } });
    const [config, state] = await Promise.all([configTask, stateTask]);
    const current_distribution_schedule = (config.distribution_schedule as []).find(obj => height >= +obj[0] && height <= +obj[1]);
    const totalMint = +current_distribution_schedule[2];
    const apr = new BigNumber(totalMint).div(state.total_bond_amount);
    const apy = (+apr / 8760 + 1) ** 8760 - 1; // pending compound calc
    return {
      apy,
    };
  }
}
