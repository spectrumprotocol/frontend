import {Pipe, PipeTransform} from '@angular/core';
import {InfoService} from '../services/info.service';
import {lp_balance_transform} from '../services/calc/balance_calc';

@Pipe({
  name: 'lpBalance'
})
export class LpBalancePipe implements PipeTransform {

  constructor() {
  }

  transform(lp: any, info: InfoService, key: string): string {
    return lp_balance_transform(lp, info, key);
  }
}
