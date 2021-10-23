import { Pipe, PipeTransform } from '@angular/core';
import BigNumber from 'bignumber.js';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';
import {plus, times} from '../libs/math';
import {CONFIG} from '../consts/config';

@Pipe({
  name: 'withdrawUst'
})
export class WithdrawUstPipe implements PipeTransform {

  transform(lp: any, poolResponse: PoolResponse): string {
    if ((typeof lp !== 'string' && typeof lp !== 'number') || !poolResponse) {
      return undefined;
    }
    let poolResponseAssetAmount;
    if (poolResponse.assets[0].info.native_token) {
      poolResponseAssetAmount = poolResponse.assets[0].amount;
    }
    else{
      poolResponseAssetAmount = poolResponse.assets[1].amount;
    }
    const ustPart = new BigNumber(lp)
      .times(poolResponseAssetAmount)
      .div(poolResponse.total_share);
    return plus(ustPart, times(ustPart, 1 - +CONFIG.WITHDRAW_UST_MAX_SPREAD));
  }
}
