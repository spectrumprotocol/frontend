import {Pipe, PipeTransform} from '@angular/core';
import {PoolResponse} from '../services/api/terraswap_pair/pool_response';
import {balance_transform} from '../services/calc/balance_calc';

@Pipe({
  name: 'balance'
})
export class BalancePipe implements PipeTransform {

  constructor() {
  }

  transform(value: any, poolResponse: PoolResponse, poolResponseB?: PoolResponse): string {
    return balance_transform(value, poolResponse, poolResponseB);
  }

}
