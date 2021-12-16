import { PoolItem as SpecPoolItem } from '../api/spec_farm/pools_response';
import { PoolItem as MirrorPoolItem } from '../api/mirror_farm/pools_response';
import { PoolItem as nAssetPsiPoolItem } from '../api/nexus_nassets_psi_farm/pools_response';
import { PoolItem as PylonLiquidPoolItem } from '../api/pylon_liquid_farm/pools_response';
import { RewardInfoResponseItem as MirrorRewardInfoResponseItem } from '../api/mirror_farm/reward_info_response';
import { RewardInfoResponseItem as SpecRewardInfoResponseItem } from '../api/spec_farm/reward_info_response';
import { InjectionToken } from '@angular/core';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { PoolResponse } from '../api/terraswap_pair/pool_response';
import { VaultsResponse } from '../api/gov/vaults_response';

export type PoolItem = SpecPoolItem | MirrorPoolItem | nAssetPsiPoolItem | PylonLiquidPoolItem;
export type FARM_TYPE_ENUM = 'LP' | 'PYLON_LIQUID';
export type PoolInfo = PoolItem & {
  farm: string;
  token_symbol: string;
  farmTokenContract: string;
  farmContract: string;
  pairSymbol: string;
  auditWarning?: boolean;
  farmType: FARM_TYPE_ENUM;
};
export type RewardInfoResponseItem = MirrorRewardInfoResponseItem | SpecRewardInfoResponseItem;

export interface PairStat {
  tvl: string;
  poolApr: number;
  poolApy: number;
  farmApr: number;
  multiplier: number;
  vaultFee: number;
  specApr?: number;
  dpr?: number;
}

export const FARM_INFO_SERVICE = new InjectionToken('FARM_INFO_SERVICE');

export interface FarmInfoService {
  // name of farm
  readonly farm: string;

  // based/pair/reward
  readonly baseSymbol?: string; // use only when asset_token in unknown (if undefined will assume tokenSymbol)
  readonly pairSymbol: string;
  readonly tokenSymbol: string; // farm reward token

  // farm/reward/gov contract
  readonly farmContract: string;
  readonly farmTokenContract: string; // for now we assumed if pairSymbol != UST, farmTokenContract is also pairContract
  readonly farmGovContract?: string;

  // auto-compound / auto-stake switch
  readonly autoCompound: boolean;
  readonly autoStake: boolean;

  // unaudit notice
  readonly auditWarning?: boolean;

  // color for chart
  readonly farmColor: string;

  readonly farmType?: FARM_TYPE_ENUM;

  queryPoolItems(): Promise<PoolItem[]>;
  queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse): Promise<Record<string, PairStat>>;
  queryRewards(): Promise<RewardInfoResponseItem[]>;
  getStakeGovMsg?(amount: string, additionalData?: object): MsgExecuteContract;
}
