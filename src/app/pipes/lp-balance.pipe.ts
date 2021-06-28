import { Pipe, PipeTransform } from '@angular/core';
import BigNumber from 'bignumber.js';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';

@Pipe({
  name: 'lpBalance'
})
export class LpBalancePipe implements PipeTransform {

  transform(lp: any, poolResponse: PoolResponse): string {
    if (typeof lp !== 'string' || !poolResponse) {
      return undefined;
    }
    if (poolResponse.assets[0].info.native_token) {
      return new BigNumber(lp)
        .times(poolResponse.assets[0].amount)
        .div(poolResponse.total_share)
        .times(2)
        .toString();
    } else {
      return new BigNumber(lp)
        .times(poolResponse.assets[1].amount)
        .div(poolResponse.total_share)
        .times(2)
        .toString();
    }


  }
}
