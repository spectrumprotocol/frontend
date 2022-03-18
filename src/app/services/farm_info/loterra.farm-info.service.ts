import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { LoterraFarmService } from '../api/loterra-farm.service';
import { PoolItem } from '../api/loterra_farm/pools_response';
import { RewardInfoResponseItem } from '../api/loterra_farm/reward_info_response';
import { TerrajsService } from '../terrajs.service';
import { DEX, FARM_TYPE_ENUM, FarmInfoService, PairStat, PoolInfo } from './farm-info.service';
import { PoolResponse } from '../api/terraswap_pair/pool_response';
import { VaultsResponse } from '../api/gov/vaults_response';
import { Denom } from '../../consts/denom';
import { PairInfo } from '../api/terraswap_factory/pair_info';
import { WasmService } from 'src/app/services/api/wasm.service';
import { div } from 'src/app/libs/math';

@Injectable()
export class LoterraFarmInfoService implements FarmInfoService {
  farm = 'Loterra';
  autoCompound = true;
  autoStake = false;
  farmColor = '#ff0dff';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Terraswap';
  denomTokenContract = Denom.USD;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.loterraToken;
  }

  constructor(
    private loterraFarm: LoterraFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService
  ) { }

  get farmContract() {
    return this.terrajs.settings.loterraFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.loterraToken;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.loterraFarm.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const rewardInfoTask = this.wasm.query(this.terrajs.settings.loterraStaking, { holder: { address: this.terrajs.settings.loterraFarm } }).catch(_ => ({}));
    const farmConfigTask = this.loterraFarm.query({ config: {} });
    const stakingStateTask = this.wasm.query(this.terrajs.settings.loterraStaking, { state: {} }).catch(_ => ({}));

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.loterraFarm)?.weight || 0;
    const pairs: Record<string, PairStat> = {};

    const key = `${this.dex}|${this.terrajs.settings.loterraToken}|${Denom.USD}`;

    const [rewardInfo, farmConfig, stakingState] = await Promise.all([rewardInfoTask, farmConfigTask, stakingStateTask]);
    const communityFeeRate = +farmConfig.community_fee;
    const p = poolResponses[key];
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }

    const poolApr = calculateApr(p, stakingState.total_balance ?? '0');
    pairs[key] = createPairStat(poolApr, key);

    const pair = pairs[key];
    const value = new BigNumber(uusd.amount)
      .times(rewardInfo.balance ?? 0)
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
        farmApr: 0,
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }

    function calculateApr(poolResponse: PoolResponse, stakingBalance: string): number {
      if (poolResponse.total_share === '0' || poolResponse.assets[0].amount === '0') {
        return 0;
      }

      const x = div(poolResponse.total_share, poolResponse.assets[0].amount);
      const y = div(div(stakingBalance, x), 1000000);
      const z = y === '0' ? 0 : div(100000, y);

      return +z;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.loterraFarm.query({
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  get farmGovContract() {
    return this.terrajs.settings.loterraGov;
  }
}
