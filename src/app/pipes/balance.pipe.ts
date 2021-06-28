import { Pipe, PipeTransform } from '@angular/core';
import BigNumber from 'bignumber.js';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';

@Pipe({
  name: 'balance'
})
export class BalancePipe implements PipeTransform {

  transform(value: any, poolResponse: PoolResponse): string {
    if (typeof value !== 'string' || !poolResponse) {
      return undefined;
    }
    if (poolResponse.assets[0].info.native_token) {
      return new BigNumber(value)
        .times(poolResponse.assets[0].amount)
        .div(poolResponse.assets[1].amount)
        .toString();
    } else {
      return new BigNumber(value)
      .times(poolResponse.assets[1].amount)
      .div(poolResponse.assets[0].amount)
      .toString();
    }

  }

}
