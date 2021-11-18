import { DecimalPipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import BigNumber from 'bignumber.js';
import { CONFIG } from '../consts/config';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';

@Pipe({
  name: 'lpSplit'
})
export class LpSplitPipe implements PipeTransform {

  constructor(
    private decimalPipe: DecimalPipe
  ) { }

  transform(lp: number, poolResponse: PoolResponse, symbol: string, digitsInfo?: string, decimals?: number): string {
    if (typeof lp !== 'number' || !poolResponse) {
      return undefined;
    }
    const asset_decimals = decimals ? decimals : 6;
    const amount1 = new BigNumber(lp)
      .times(poolResponse.assets[0].amount)
      .div(poolResponse.total_share)
      .times(poolResponse.assets[0].info.native_token ? new BigNumber(1) : new BigNumber(10).exponentiatedBy(6 - asset_decimals))
      .toString();
    const amount2 = new BigNumber(lp)
      .times(poolResponse.assets[1].amount)
      .div(poolResponse.total_share)
      .times(poolResponse.assets[1].info.native_token ? new BigNumber(1) : new BigNumber(10).exponentiatedBy(6 - asset_decimals))
      .toString();
    if (poolResponse.assets[0].info.native_token) {
      return `${this.decimalPipe.transform(amount2, digitsInfo)} ${symbol} + ${this.decimalPipe.transform(amount1, digitsInfo)} UST`;
    } else {
      return `${this.decimalPipe.transform(amount1, digitsInfo)} ${symbol} + ${this.decimalPipe.transform(amount2, digitsInfo)} UST`;
    }
  }

}
