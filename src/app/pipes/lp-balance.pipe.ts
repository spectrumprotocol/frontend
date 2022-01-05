import { Pipe, PipeTransform } from '@angular/core';
import BigNumber from 'bignumber.js';
import { BalancePipe } from './balance.pipe';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';
import {Denom} from '../consts/denom';

@Pipe({
  name: 'lpBalance'
})
export class LpBalancePipe implements PipeTransform {

  constructor(
    private balancePipe: BalancePipe
  ) { }

  transform(lp: any, poolResponses: Record<string, PoolResponse>, key: string): string {
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
      const token1Price = this.balancePipe.transform('1', poolResponses[dex + '|' + poolResponse.assets[0].info.token['contract_addr'] + '|' + Denom.USD]);
      if (token1Price) {
        return new BigNumber(lp)
          .times(poolResponse.assets[0].amount)
          .div(poolResponse.total_share)
          .times(token1Price)
          .times(2)
          .toString();
      }
      const token2Price = this.balancePipe.transform('1', poolResponses[dex + '|' + poolResponse.assets[1].info.token['contract_addr'] + '|' + Denom.USD]);
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
  }
}
