export interface StakingPool {
  total_bond_amount: string;
  short_reward_weight: string;
  total_short_amount: string;
}

export interface AssetInfo {
  token: { contract_addr: string };
}

export interface NativeInfo {
  native_token: { denom: string };
}

export interface AssetToken {
  amount: string;
  info: AssetInfo;
}

export interface NativeToken {
  amount: string;
  info: NativeInfo;
}

export interface PairPool {
  assets: (AssetToken | NativeToken)[];
  total_share: string;
}
