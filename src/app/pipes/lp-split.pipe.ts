import { Pipe, PipeTransform } from '@angular/core';
import BigNumber from 'bignumber.js';
import { CONFIG } from '../consts/config';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';
import { UnitPipe } from './unit.pipe';
import {TerrajsService} from '../services/terrajs.service';

@Pipe({
  name: 'lpSplit'
})
export class LpSplitPipe implements PipeTransform {

  constructor(
    private unitPipe: UnitPipe,
    private terrajs: TerrajsService
  ) { }

  transform(lp: number, poolResponse: PoolResponse, baseSymbol: string, denomSymbol: string, decimals?: number, digitsInfo?: string): string {
    if (typeof lp !== 'number' || !poolResponse) {
      return undefined;
    }
    const fullLp = new BigNumber(lp).times(CONFIG.UNIT);
    const amount1 = fullLp
      .times(poolResponse.assets[0].amount)
      .div(poolResponse.total_share)
      .toString();
    const amount2 = fullLp
      .times(poolResponse.assets[1].amount)
      .div(poolResponse.total_share)
      .toString();
    if (poolResponse.assets[0].info.native_token) {
      return `${this.unitPipe.transform(amount2, decimals, digitsInfo)} ${baseSymbol} + ${this.unitPipe.transform(amount1, 6, digitsInfo)} ${denomSymbol}`;
    } else if (poolResponse.assets[0].info.token['contract_addr'] === this.terrajs.settings.nexusToken && poolResponse.assets[1].info.token) {
      // handle Astroport Psi-nAsset case
      return `${this.unitPipe.transform(amount2, decimals, digitsInfo)} ${baseSymbol} + ${this.unitPipe.transform(amount1, 6, digitsInfo)} ${denomSymbol}`;
    } else {
      return `${this.unitPipe.transform(amount1, decimals, digitsInfo)} ${baseSymbol} + ${this.unitPipe.transform(amount2, 6, digitsInfo)} ${denomSymbol}`;
    }
  }

}
