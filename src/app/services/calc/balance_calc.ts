import BigNumber from 'bignumber.js';
import {Denom} from '../../consts/denom';
import {div} from '../../libs/math';
import {PoolResponse} from '../api/terraswap_pair/pool_response';

export const balance_transform = (value: any, poolResponse: PoolResponse, poolResponseB?: PoolResponse) => {
  if (typeof value !== 'string' || !poolResponse) {
    return undefined;
  }
  if (poolResponse.assets[0].info.native_token?.['denom'] === 'uusd') {
    return new BigNumber(value)
      .times(poolResponse.assets[0].amount)
      .div(poolResponse.assets[1].amount)
      .toString();
  } else if (poolResponse.assets[1].info.native_token?.['denom'] === 'uusd') {
    return new BigNumber(value)
      .times(poolResponse.assets[1].amount)
      .div(poolResponse.assets[0].amount)
      .toString();
  } else if (poolResponseB) {
    const basePrice = balance_transform('1', poolResponseB);
    const baseAsset = poolResponseB.assets.find(asset => asset.info.native_token?.['denom'] !== 'uusd');
    const [assetA, assetB] = poolResponse.assets[0].info.token?.['contract_addr'] === baseAsset.info.token?.['contract_addr']
      ? [poolResponse.assets[0], poolResponse.assets[1]]
      : [poolResponse.assets[1], poolResponse.assets[0]];
    const assetPerBaseAsset = div(assetA.amount, assetB.amount);
    return new BigNumber(value)
      .times(assetPerBaseAsset)
      .times(basePrice)
      .toString();
  } else {
    return null;
  }
};

export const lp_balance_transform = (lp: any, poolResponses: Record<string, PoolResponse>, key: string) => {
  if ((typeof lp !== 'string' && typeof lp !== 'number') || !poolResponses[key]) {
    return undefined;
  }
  const poolResponse = poolResponses[key];

  if (poolResponse.assets[0].info.native_token?.['denom'] === Denom.USD) {
    return new BigNumber(lp)
      .times(poolResponse.assets[0].amount)
      .div(poolResponse.total_share)
      .times(2)
      .toString();
  } else if (poolResponse.assets[1].info.native_token?.['denom'] === Denom.USD) {
    return new BigNumber(lp)
      .times(poolResponse.assets[1].amount)
      .div(poolResponse.total_share)
      .times(2)
      .toString();
  } else {
    const dex = key.split('|')[0];
    const asset0Token: string = poolResponse.assets[0].info.token
      ? poolResponse.assets[0].info.token?.['contract_addr']
      : poolResponse.assets[0].info.native_token?.['denom'];
    const token1Price = balance_transform('1', poolResponses[`${dex}|${asset0Token}|${Denom.USD}`]);
    if (token1Price) {
      return new BigNumber(lp)
        .times(poolResponse.assets[0].amount)
        .div(poolResponse.total_share)
        .times(token1Price)
        .times(2)
        .toString();
    }
    const asset1Token: string = poolResponse.assets[1].info.token
      ? poolResponse.assets[1].info.token?.['contract_addr']
      : poolResponse.assets[1].info.native_token?.['denom'];
    const token2Price = balance_transform('1', poolResponses[`${dex}|${asset1Token}|${Denom.USD}`]);
    if (token2Price) {
      return new BigNumber(lp)
        .times(poolResponse.assets[1].amount)
        .div(poolResponse.total_share)
        .times(token2Price)
        .times(2)
        .toString();
    }
    return null;
  }
};
