import {Pipe, PipeTransform} from '@angular/core';
import {BalancePipe} from './balance.pipe';
import {InfoService} from '../services/info.service';
import {TerrajsService} from '../services/terrajs.service';
import {lp_balance_transform} from '../services/calc/balance_calc';

@Pipe({
  name: 'lpBalance'
})
export class LpBalancePipe implements PipeTransform {

  constructor(
    private balancePipe: BalancePipe,
    private terrajs: TerrajsService
  ) {
  }

  transform(lp: any, info: InfoService, key: string): string {
    return lp_balance_transform(lp, info.poolResponses, key);
  }
}
