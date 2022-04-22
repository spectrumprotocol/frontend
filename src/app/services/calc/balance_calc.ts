import BigNumber from 'bignumber.js';
import {Denom} from '../../consts/denom';
import {div, times} from '../../libs/math';
import {PoolResponse} from '../api/terraswap_pair/pool_response';
import {getStablePrice} from '../../libs/stable';
import {InfoService} from '../info.service';

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

export const lp_balance_transform = (lp: any, info: InfoService, key: string) => {
  if ((typeof lp !== 'string' && typeof lp !== 'number') || !info.poolResponses[key]) {
    return undefined;
  }
  const poolResponse = info.poolResponses[key];

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
  } else if (key === `Astroport|${info.terrajs.settings.stlunaToken}|${info.terrajs.settings.ldoToken}`) {
    const stlunaLdoPoolResponses = poolResponse;

    const stlunaLunaPoolResponses = info.poolResponses[`Astroport|${info.terrajs.settings.stlunaToken}|${Denom.LUNA}`];
    const [ulunaAsset, stluna] = stlunaLunaPoolResponses.assets[0].info.native_token?.['denom'] === Denom.LUNA
      ? [stlunaLunaPoolResponses.assets[0], stlunaLunaPoolResponses.assets[1]]
      : [stlunaLunaPoolResponses.assets[1], stlunaLunaPoolResponses.assets[0]];
    if (!ulunaAsset) {
      return;
    }
    const ulunaPrice = balance_transform('1', info.poolResponses[`Astroport|${Denom.LUNA}|${Denom.USD}`]);
    const stlunaPriceInLuna = getStablePrice(+stluna.amount, +ulunaAsset.amount);
    const stlunaPriceInUST = times(ulunaPrice, stlunaPriceInLuna);
    const stlunaAsset = stlunaLdoPoolResponses.assets.find(a => a.info.token?.['contract_addr'] === info.terrajs.settings.stlunaToken);
    if (!stlunaAsset) {
      return;
    }
    return new BigNumber(lp)
      .times(stlunaAsset.amount)
      .div(stlunaLdoPoolResponses.total_share)
      .times(stlunaPriceInUST)
      .times(2)
      .toString();
  } else {
    const dex = key.split('|')[0];
    const asset0Token: string = poolResponse.assets[0].info.token
      ? poolResponse.assets[0].info.token?.['contract_addr']
      : poolResponse.assets[0].info.native_token?.['denom'];
    const token0Price = balance_transform('1', info.poolResponses[`${dex}|${asset0Token}|${Denom.USD}`]);
    if (token0Price) {
      if (info.pairInfos[key].pair_type?.['stable']) {
        const asset1Price = getStablePrice(+poolResponse.assets[1].amount, +poolResponse.assets[0].amount);
        const asset1Swap = new BigNumber(lp)
          .times(poolResponse.assets[1].amount)
          .div(poolResponse.total_share)
          .times(asset1Price)
          .integerValue(BigNumber.ROUND_DOWN);
        return new BigNumber(lp)
          .times(poolResponse.assets[0].amount)
          .div(poolResponse.total_share)
          .plus(asset1Swap)
          .times(token0Price)
          .toString();
      } else {
        return new BigNumber(lp)
          .times(poolResponse.assets[0].amount)
          .div(poolResponse.total_share)
          .times(token0Price)
          .times(2)
          .toString();
      }
    }
    const asset1Token: string = poolResponse.assets[1].info.token
      ? poolResponse.assets[1].info.token?.['contract_addr']
      : poolResponse.assets[1].info.native_token?.['denom'];
    const token1Price = balance_transform('1', info.poolResponses[`${dex}|${asset1Token}|${Denom.USD}`]);
    if (token1Price) {
      if (info.pairInfos[key].pair_type?.['stable']) {
        const asset0Price = getStablePrice(+poolResponse.assets[0].amount, +poolResponse.assets[1].amount);
        const asset0Swap = new BigNumber(lp)
          .times(poolResponse.assets[0].amount)
          .div(poolResponse.total_share)
          .times(asset0Price)
          .integerValue(BigNumber.ROUND_DOWN);
        return new BigNumber(lp)
          .times(poolResponse.assets[1].amount)
          .div(poolResponse.total_share)
          .plus(asset0Swap)
          .times(token1Price)
          .toString();
      } else {
        return new BigNumber(lp)
          .times(poolResponse.assets[1].amount)
          .div(poolResponse.total_share)
          .times(token1Price)
          .times(2)
          .toString();
      }
    }
    return null;
  }
};
