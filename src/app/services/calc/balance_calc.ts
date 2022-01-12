import BigNumber from 'bignumber.js';
import { PoolResponse } from '../api/terraswap_pair/pool_response';

export const balance_transform = (value: any, poolResponse: PoolResponse) => {
  if (typeof value !== 'string' || !poolResponse) {
    return undefined;
  }
  if (poolResponse.assets[0].info.native_token) {
    return new BigNumber(value)
      .times(poolResponse.assets[0].amount)
      .div(poolResponse.assets[1].amount)
      .toString();
  } else if (poolResponse.assets[1].info.native_token) {
    return new BigNumber(value)
      .times(poolResponse.assets[1].amount)
      .div(poolResponse.assets[0].amount)
      .toString();
  } else {
    return null;
  }
};
