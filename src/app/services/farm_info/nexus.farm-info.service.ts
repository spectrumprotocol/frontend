import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { GovService } from '../api/gov.service';
import { TerrajsService } from '../terrajs.service';
import { FarmInfoService, PairStat, PoolInfo, PoolItem } from './farm-info.service';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { toBase64 } from '../../libs/base64';
import { PoolResponse } from '../api/terraswap_pair/pool_response';
import { HttpClient } from '@angular/common/http';
import { div, times } from '../../libs/math';
import { Denom } from '../../consts/denom';
import { NexusFarmService } from '../api/nexus-farm.service';
import { RewardInfoResponseItem } from '../api/nexus_farm/reward_info_response';
import { NexusStakingService } from '../api/nexus-staking.service';

@Injectable()
export class NexusFarmInfoService implements FarmInfoService {
  farm = 'Nexus';
  tokenSymbol = 'Psi';
  autoCompound = true;
  autoStake = false;
  farmColor = '#F4B6C7';

  constructor(
    private gov: GovService,
    private nexusFarm: NexusFarmService,
    private terrajs: TerrajsService,
    private httpClient: HttpClient,
    private nexusStaking: NexusStakingService
  ) { }

  get farmContract() {
    return this.terrajs.settings.nexusFarm;
  }

  get farmTokenContract() {
    return this.terrajs.settings.nexusToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.nexusGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.nexusFarm.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>): Promise<Record<string, PairStat>> {
    const unixTimeSecond = Math.floor(Date.now() / 1000);
    const rewardInfoTask = this.nexusStaking.query({ staker_info: { time_seconds: +unixTimeSecond, staker: this.terrajs.settings.nexusFarm } });
    const farmConfigTask = this.nexusFarm.query({ config: {} });

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govVaults = await this.gov.vaults();
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.nexusFarm)?.weight || 0;
    const nexusLPStat = await this.getNexusLPStat(poolResponses[this.terrajs.settings.nexusToken], unixTimeSecond);
    // const nexusGovStat = await this.getNexusGovStat();
    const pairs: Record<string, PairStat> = {};

    const rewardInfo = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const govConfig = await this.gov.config();
    const communityFeeRate = +farmConfig.community_fee * (1 - +govConfig.warchest_ratio);
    const p = poolResponses[this.terrajs.settings.nexusToken];
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }
    const specPsiTvl = new BigNumber(uusd.amount)
      .times(rewardInfo.bond_amount)
      .times(2)
      .div(p.total_share)
      .toString();

    const poolApr = +(nexusLPStat.apr || 0);
    pairs[this.terrajs.settings.nexusToken] = createPairStat(poolApr, this.terrajs.settings.nexusToken);
    const pair = pairs[this.terrajs.settings.nexusToken];
    pair.tvl = specPsiTvl;
    pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;

    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, token: string) {
      const poolInfo = poolInfos[token];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        farmApr: 0, // +(nexusGovStat.apy || 0),
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.nexusFarm.query({
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

  async getNexusLPStat(psiPoolResponse: PoolResponse, unixTimeSecond) {
    const configTask = this.nexusStaking.query({ config: {} });
    const stateTask = this.nexusStaking.query({ state: { time_seconds: +unixTimeSecond } });
    const [config, state] = await Promise.all([configTask, stateTask]);
    const psiPoolUSTAmount = psiPoolResponse.assets[1]?.info?.native_token?.['denom'] === Denom.USD ? psiPoolResponse.assets[1].amount : psiPoolResponse.assets[0].amount;
    const psiPoolPSIAmount = psiPoolResponse.assets[1]?.info?.token ? psiPoolResponse.assets[1].amount : psiPoolResponse.assets[0].amount;
    const psiPrice = div(psiPoolUSTAmount, psiPoolPSIAmount);
    const current_distribution_schedule = config.distribution_schedule.find(obj => unixTimeSecond >= +obj.start_time && unixTimeSecond <= +obj.end_time);
    if (!current_distribution_schedule) {
      return {
        apr: 0
      };
    }
    const totalMint = +current_distribution_schedule.amount;
    const c = new BigNumber(psiPoolUSTAmount).multipliedBy(2).div(psiPoolResponse.total_share);
    const s = new BigNumber(state.total_bond_amount).multipliedBy(c);
    const apr = new BigNumber(totalMint).multipliedBy(psiPrice).div(s);
    return {
      apr,
    };
  }
  //
  // async getNexusGovStat(){
  //   const height = await this.terrajs.getHeight();
  //   const configTask = this.wasm.query(this.terrajs.settings.nexusGov, { config: {} });
  //   const stateTask = this.wasm.query(this.terrajs.settings.nexusGov, { state: {block_height: height} });
  //   const [config, state] = await Promise.all([configTask, stateTask]);
  //   const current_distribution_schedule = (config.distribution_schedule as []).find(obj => height >= +obj[0] && height <= +obj[1]);
  //   const totalMint = +current_distribution_schedule[2];
  //   const apr = new BigNumber(totalMint).div(state.total_bond_amount);
  //   const apy = (+apr / 365 + 1) ** 365 - 1; // pending compound calc
  //   return {
  //     apy,
  //   };
  // }

}
