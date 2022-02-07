import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
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
import {GlowFarmService} from '../api/glow-farm.service';
import {Decimal, Uint128} from '../api/glow_farm/pools_response';

@Injectable()
export class GlowFarmInfoService implements FarmInfoService {
  farm = 'Glow';
  autoCompound = true;
  autoStake = true;
  auditWarning = false;
  farmColor = '#0d0822'; // #6836e8
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Terraswap';
  denomTokenContract = Denom.USD;
  mainnetOnly = true;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.glowToken;
  }

  constructor(
    private glowFarmService: GlowFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService
  ) { }

  get farmContract() {
    return this.terrajs.settings.glowFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.glowToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.glowGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.glowFarmService.query({pools: {}});
    // return pool.pools;
    // @ts-ignore
    return [{
      asset_token: this.terrajs.settings.glowToken,
      auto_spec_share_index: '0',
      farm_share: '0',
      farm_share_index: 0,
      stake_spec_share_index: 0,
      staking_token: this.terrajs.settings.glowLp,
      state_spec_share_index: '0',
      total_auto_bond_share: '0',
      total_stake_bond_amount: '0',
      total_stake_bond_share: '0',
      weight: 0
    }];
  }


  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const height = await this.terrajs.getHeight();
    const rewardInfoTask = this.wasm.query(this.terrajs.settings.glowStaking, { staker_info: { block_height: +height, staker: this.terrajs.settings.glowFarm } });
    const farmConfigTask = this.glowFarmService.query({ config: {} });

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.glowFarm)?.weight || 0;
    const key = `${this.dex}|${this.terrajs.settings.glowToken}|${Denom.USD}`;
    const glowLPTask = this.getGlowLPStat(poolResponses[key]);
    const glowGovTask = this.getGlowGovStat();
    const pairs: Record<string, PairStat> = {};

    // lp gov to be continued
    const [glowLPStat, glowGovStat, rewardInfo, farmConfig] = await Promise.all([glowLPTask, glowGovTask, rewardInfoTask, farmConfigTask]);
    const communityFeeRate = +farmConfig.community_fee;
    const p = poolResponses[key];
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }
    const tvl = new BigNumber(uusd.amount)
      .times(rewardInfo.bond_amount)
      .times(2)
      .div(p.total_share)
      .toString();

    const poolApr = +(glowLPStat.apr || 0);
    pairs[key] = createPairStat(poolApr, key);
    const pair = pairs[key];
    pair.tvl = tvl;
    pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;

    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, key: string) {
      const poolInfo = poolInfos[key];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        farmApr: +(glowGovStat.apy || 0),
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.glowFarmService.query({
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  getStakeGovMsg(amount: string): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.glowToken,
      {
        send: {
          contract: this.terrajs.settings.glowGov,
          amount,
          msg: toBase64({stake_voting_tokens: {}})
        }
      }
    );
  }

  //TODO
  async getGlowLPStat(glowPoolResponse: PoolResponse) {
    const height = await this.terrajs.getHeight();
    const configTask = this.wasm.query(this.terrajs.settings.glowStaking, { config: {} });
    const stateTask = this.wasm.query(this.terrajs.settings.glowStaking, { state: { block_height: height } });
    const [config, state] = await Promise.all([configTask, stateTask]);
    const glowPoolUSTAmount = glowPoolResponse.assets[1]?.info?.native_token?.['denom'] === Denom.USD ? glowPoolResponse.assets[1].amount : glowPoolResponse.assets[0].amount;
    const glowPoolGlowAmount = glowPoolResponse.assets[1]?.info?.token ? glowPoolResponse.assets[1].amount : glowPoolResponse.assets[0].amount;
    const glowPrice = div(glowPoolUSTAmount, glowPoolGlowAmount);
    const current_distribution_schedule = (config.distribution_schedule as []).find(obj => height >= +obj[0] && height <= +obj[1]);
    const totalMint = +current_distribution_schedule[2];
    const c = new BigNumber(glowPoolUSTAmount).multipliedBy(2).div(glowPoolResponse.total_share);
    const s = new BigNumber(state.total_bond_amount).multipliedBy(c);
    const apr = new BigNumber(totalMint).multipliedBy(glowPrice).div(s);
    return {
      apr,
    };
  }

  // TODO
  async getGlowGovStat() {
    // const fixAmount = new BigNumber(3e12);
    // const govBalanceTask = this.wasm.query(this.terrajs.settings.glowToken, { balance: { address: this.terrajs.settings.glowGov } });
    // const [govBalance] = await Promise.all([govBalanceTask]);
    // const apy = fixAmount.div(govBalance.balance).div(2).toNumber();
    const apy = 0;
    return {
      apy,
    };
  }
}
