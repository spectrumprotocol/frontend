import { PoolItem as SpecPoolItem } from '../api/spec_farm/pools_response';
import { PoolItem as MirrorPoolItem } from '../api/mirror_farm/pools_response';
import { RewardInfoResponseItem as MirrorRewardInfoResponseItem } from '../api/mirror_farm/reward_info_response';
import { RewardInfoResponseItem as SpecRewardInfoResponseItem } from '../api/spec_farm/reward_info_response';
import { InjectionToken } from '@angular/core';
import {MsgExecuteContract} from '@terra-money/terra.js';
import { PoolResponse } from '../api/terraswap_pair/pool_response';

export type PoolItem = SpecPoolItem | MirrorPoolItem;
export type PoolInfo = PoolItem & { farm: string; token_symbol: string; farmTokenContract: string; farmContract: string };
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
  farm: string;
  tokenSymbol: string;
  readonly farmContract: string;
  readonly farmTokenContract: string;
  readonly autoCompound: boolean;
  readonly autoStake: boolean;
  readonly auditWarning?: boolean;

  queryPoolItems(): Promise<PoolItem[]>;
  queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>): Promise<Record<string, PairStat>>;
  queryRewards(): Promise<RewardInfoResponseItem[]>;
  getStakeGovMsg(amount: string): MsgExecuteContract;
}
