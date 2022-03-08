import { Pipe, PipeTransform } from '@angular/core';
import BigNumber from 'bignumber.js';
import { BalancePipe } from './balance.pipe';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';
import { Denom } from '../consts/denom';
import { getStablePrice } from '../libs/stable';
import { InfoService } from '../services/info.service';

@Pipe({
  name: 'lpBalance'
})
export class LpBalancePipe implements PipeTransform {

  constructor(
    private balancePipe: BalancePipe,
  ) { }

  transform(lp: any, info: InfoService, key: string): string {
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
    } else {
      const dex = key.split('|')[0];
      const asset0Token: string = poolResponse.assets[0].info.token
        ? poolResponse.assets[0].info.token?.['contract_addr']
        : poolResponse.assets[0].info.native_token?.['denom'];
      const token0Price = this.balancePipe.transform('1', info.poolResponses[`${dex}|${asset0Token}|${Denom.USD}`]);
      if (token0Price) {
        if (info.pairInfos[key].pair_type['stable']) {
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
      const token1Price = this.balancePipe.transform('1', info.poolResponses[`${dex}|${asset1Token}|${Denom.USD}`]);
      if (token1Price) {
        if (info.pairInfos[key].pair_type['stable']) {
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
  }
}
