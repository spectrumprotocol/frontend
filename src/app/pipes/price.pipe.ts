import { Pipe, PipeTransform } from '@angular/core';
import { div } from '../libs/math';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';

@Pipe({
  name: 'price'
})
export class PricePipe implements PipeTransform {

  transform(poolResponse: PoolResponse) {
    if (!poolResponse) {
      return undefined;
    }
    if (poolResponse.assets[0].info.native_token) {
      return div(poolResponse.assets[0].amount, poolResponse.assets[1].amount);
    } else {
      return div(poolResponse.assets[1].amount, poolResponse.assets[0].amount);
    }
  }

}
