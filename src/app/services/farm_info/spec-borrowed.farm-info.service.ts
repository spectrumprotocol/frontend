import { Injectable } from '@angular/core';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { CONFIG } from 'src/app/consts/config';
import { Denom } from 'src/app/consts/denom';
import { plus, times } from 'src/app/libs/math';
import { GovService } from '../api/gov.service';
import { VaultsResponse } from '../api/gov/vaults_response';
import { SpecBorrowedFarmService } from '../api/spec-borrowed-farm.service';
import { PairInfo } from '../api/terraswap_factory/pair_info';
import { PoolResponse } from '../api/terraswap_pair/pool_response';
import { TerrajsService } from '../terrajs.service';
import { FarmInfoService, PairStat, PoolInfo, PoolItem, RewardInfoResponseItem } from './farm-info.service';

@Injectable()
export class SpecBorrowedFarmInfoService implements FarmInfoService {
  farm = 'Spectrum';
  autoCompound = true;
  autoStake = false;
  farmColor = '#fc5185';
  auditWarning = false;
  farmType = 'BORROWED' as const;
  dex = 'Terraswap' as const;
  govLock = false;
  highlight = false;

  constructor(
    private terrajs: TerrajsService,
    private specBorrowedFarm: SpecBorrowedFarmService,
    private gov: GovService
  ) { }

  get farmContract() {
    return this.terrajs.settings.specBorrowedFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.specToken;
  }

  get defaultBaseTokenContract() {
    return Denom.USD;
  }

  // borrowed token
  get denomTokenContract() {
    return this.terrajs.settings.specToken;
  }

  queryPoolItems(): Promise<PoolItem[]> {
    throw new Error('Method not implemented.');
  }

  queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    throw new Error('Method not implemented.');
  }

  queryRewards(): Promise<RewardInfoResponseItem[]> {
    throw new Error('Method not implemented.');
  }

  async getCustomPoolInfos(): Promise<Omit<PoolInfo, 'key'>[]> {
    return [
      {
        farm: this.farm,
        farmContract: this.farmContract,
        baseTokenContract: Denom.USD,
        denomTokenContract: this.denomTokenContract,
        rewardTokenContract: this.rewardTokenContract,
        rewardKey: `${this.dex}|${this.rewardTokenContract}|${Denom.USD}`,
        auto_compound: this.autoCompound,
        auto_stake: this.autoStake,
        govLock: this.govLock ?? false,
        forceDepositType: 'compound',
        auditWarning: this.auditWarning,
        farmType: this.farmType,
        score: this.highlight ? 1000000 : 0,
        dex: this.dex,
        highlight: this.highlight ?? false,
        hasProxyReward: false,

        // need to clean up interface
        asset_token: this.denomTokenContract,
        spec_share_index: '0',
        staking_token: '',
        state_spec_share_index: '0',
        total_bond_amount: '0',
        weight: 0,
      } as const
    ];
  }

  async getUserCredit(): Promise<string> {
    const config = await this.specBorrowedFarm.query({ config: {} });
    const balance = await this.gov.balance();

    return balance.pools?.reduce((sum, pool) => {
      const credit = config.gov.credits.find(c => c.days === pool.days);
      const multiplier = +credit?.credit || 0;

      return plus(sum, times(pool.balance, multiplier));
    }, '0');
  }
}
