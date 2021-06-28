import { PairInfo } from '../api/terraswap_factory/pair_info';
import { PoolItem as SpecPoolItem } from '../api/spec_farm/pools_response';
import { PoolItem as MirrorPoolItem } from '../api/mirror_farm/pools_response';
import { RewardInfoResponseItem as MirrorRewardInfoResponseItem } from '../api/mirror_farm/reward_info_response';
import { RewardInfoResponseItem as SpecRewardInfoResponseItem } from '../api/spec_farm/reward_info_response';
import { InjectionToken } from '@angular/core';

export type PoolItem = SpecPoolItem | MirrorPoolItem;
export type PoolInfo = PoolItem & { farm: string };
export type RewardInfoResponseItem = MirrorRewardInfoResponseItem | SpecRewardInfoResponseItem;

export interface PairStat {
  tvl: string;
  poolApr: number;
  poolApy: number;
  farmApr: number;
  multiplier: number;
  vaultFee: number;
  specApr?: number;
}

export const FARM_INFO_SERVICE = new InjectionToken('FARM_INFO_SERVICE');

export interface FarmInfoService {
  farmName: string;
  queryPoolItems(): Promise<PoolItem[]>;
  queryPairStats(poolInfos: Record<string, PoolInfo>, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>>;
  queryRewards(): Promise<RewardInfoResponseItem[]>;
}
