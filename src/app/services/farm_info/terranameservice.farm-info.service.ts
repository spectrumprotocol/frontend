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
import {TerraNameServiceFarmService} from '../api/terranameservice-farm.service';

@Injectable()
export class TerraNameServiceFarmInfoService implements FarmInfoService {
  farm = 'TNS';
  autoCompound = true;
  autoStake = true;
  auditWarning = true;
  farmColor = '#121db9';
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Terraswap';
  denomTokenContract = Denom.USD;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.terraNameServiceToken;
  }

  constructor(
    private terraNameServiceFarmService: TerraNameServiceFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService
  ) { }

  get farmContract() {
    return this.terrajs.settings.terraNameServiceFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.terraNameServiceToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.terraNameServiceGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.terraNameServiceFarmService.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const height = await this.terrajs.getHeight();
    const rewardInfoTask = this.wasm.query(this.terrajs.settings.terraNameServiceStaking, { staker_info: { block_height: +height, staker: this.terrajs.settings.terraNameServiceFarm } });
    const farmConfigTask = this.terraNameServiceFarmService.query({ config: {} });

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.terraNameServiceFarm)?.weight || 0;
    const key = `${this.dex}|${this.terrajs.settings.terraNameServiceToken}|${Denom.USD}`;
    const terraNameServiceLPTask = this.getterraNameServiceLPStat(poolResponses[key]);
    const terraNameServiceGovTask = this.getterraNameServiceGovStat();
    const pairs: Record<string, PairStat> = {};

    // lp gov to be continued
    const [terraNameServiceLPStat, terraNameServiceGovStat, rewardInfo, farmConfig] = await Promise.all([terraNameServiceLPTask, terraNameServiceGovTask, rewardInfoTask, farmConfigTask]);
    console.log(rewardInfo)
    const test = await this.terraNameServiceFarmService.query({
      pools: {}
    });
    console.log(test.pools[0])
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

    const poolApr = +(terraNameServiceLPStat.apr || 0);
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
        farmApr: +(terraNameServiceGovStat.apy || 0),
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.terraNameServiceFarmService.query({
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  getStakeGovMsg(amount: string): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.terraNameServiceToken,
      {
        send: {
          contract: this.terrajs.settings.terraNameServiceGov,
          amount,
          msg: toBase64({ bond: {} })
        }
      }
    );
  }

  async getterraNameServiceLPStat(tnsPoolResponse: PoolResponse) {
    const height = await this.terrajs.getHeight();
    const configTask = this.wasm.query(this.terrajs.settings.terraNameServiceStaking, { config: {} });
    const stateTask = this.wasm.query(this.terrajs.settings.terraNameServiceStaking, { state: { block_height: height } });
    const [config, state] = await Promise.all([configTask, stateTask]);
    const poolUSTAmount = tnsPoolResponse.assets[1]?.info?.native_token?.['denom'] === Denom.USD ? tnsPoolResponse.assets[1].amount : tnsPoolResponse.assets[0].amount;
    const poolTWDAmount = tnsPoolResponse.assets[1]?.info?.token ? tnsPoolResponse.assets[1].amount : tnsPoolResponse.assets[0].amount;
    const twdPrice = div(poolUSTAmount, poolTWDAmount);
    const current_distribution_schedule = (config.distribution_schedule as []).find(obj => height >= +obj[0] && height <= +obj[1]);
    const totalMint = +current_distribution_schedule[2];
    const c = new BigNumber(poolUSTAmount).multipliedBy(2).div(tnsPoolResponse.total_share);
    const s = new BigNumber(state.total_bond_amount).multipliedBy(c);
    const apr = new BigNumber(totalMint).multipliedBy(twdPrice).div(s);
    return {
      apr,
    };
  }

  async getterraNameServiceGovStat() {
    const fixAmount = new BigNumber(3e12);
    const govBalanceTask = this.wasm.query(this.terrajs.settings.terraNameServiceToken, { balance: { address: this.terrajs.settings.terraNameServiceGov } });
    const [govBalance] = await Promise.all([govBalanceTask]);
    const apy = fixAmount.div(govBalance.balance).div(2).toNumber();
    return {
      apy,
    };
  }
}
