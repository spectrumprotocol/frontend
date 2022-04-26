import { Injectable } from '@angular/core';
import { Denom } from '../../consts/denom';
import { VaultsResponse } from '../api/gov/vaults_response';
import { LunaBurnFarmService } from '../api/luna-burn-farm.service';
import { RewardInfoResponseItem } from '../api/luna_burn_farm/reward_info_response';
import { PairInfo } from '../api/terraswap_factory/pair_info';
import { PoolResponse } from '../api/terraswap_pair/pool_response';
import { TerrajsService } from '../terrajs.service';
import { DEX, FarmInfoService, FARM_TYPE_ENUM, PairStat, PoolInfo, PoolItem, Unbonding } from './farm-info.service';

@Injectable()
export class LunaBurnFarmInfoService implements FarmInfoService {
  farm = 'Luna Burn';
  autoCompound = true;
  autoStake = false;
  farmColor = '#f9d85e';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LUNA_BURN';
  dex: DEX = 'Terraswap';
  denomTokenContract = Denom.LUNA;

  get defaultBaseTokenContract() {
    return '';
  }

  constructor(
    private lunaBurnFarm: LunaBurnFarmService,
    private terrajs: TerrajsService
  ) { }

  get farmContract() {
    return this.terrajs.settings.lunaBurnFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.specToken;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    return [
      {
        asset_token: 'uluna',
        auto_spec_share_index: '0',
        farm_share: '0',
        farm_share_index: '0',
        stake_spec_share_index: '0',
        state_spec_share_index: '0',
        total_auto_bond_share: '0',
        total_stake_bond_amount: '0',
        total_stake_bond_share: '0',
        weight: 0,
      }
    ];
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const farmConfigTask = this.lunaBurnFarm.query({ config: {} });

    // action
    const pairs: Record<string, PairStat> = {};

    const poolApr = 0;
    const key = `${this.dex}|${this.terrajs.settings.orionToken}|${Denom.USD}`;
    pairs[key] = createPairStat(poolApr, key);

    // const rewardInfo = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const communityFeeRate = +farmConfig.community_fee;
    const pair = pairs[key];
    pair.tvl = '0';
    pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;

    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, key: string) {
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        farmApr: 0,
        tvl: '0',
        multiplier: 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.lunaBurnFarm.query({
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  get farmGovContract() {
    return '';
  }

  async getUnbondings(): Promise<Unbonding[]> {
    const state = await this.lunaBurnFarm.query({ state: {} });
    const unbond = await this.lunaBurnFarm.query({ unbond: { staker_addr: this.terrajs.address } });

    return unbond.map((item) => ({
      amount: item.amount,
      claimable: item.unbonding_index <= state.unbonded_index,
    }));
  }
}
