import { Pipe, PipeTransform } from '@angular/core';
import BigNumber from 'bignumber.js';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';
import { TerrajsService } from '../services/terrajs.service';
import { Denom } from '../consts/denom';
import { div, times } from '../libs/math';
import { InfoService } from '../services/info.service';

@Pipe({
  name: 'balance'
})
export class BalancePipe implements PipeTransform {

  constructor(
    private terrajs: TerrajsService,
  ) { }

  transform(value: any, poolResponse: PoolResponse, poolResponseB?: PoolResponse): string {
    if (typeof value !== 'string' || !poolResponse) {
      return undefined;
    }
    if (poolResponse.assets[0].info.native_token?.['denom'] === 'uusd') {
      return new BigNumber(value)
        .times(poolResponse.assets[0].amount)
        .div(poolResponse.assets[1].amount)
        .toString();
    } else if (poolResponse.assets[1].info.native_token?.['denom'] === 'uusd') {
      return new BigNumber(value)
        .times(poolResponse.assets[1].amount)
        .div(poolResponse.assets[0].amount)
        .toString();
    } else if (poolResponseB) {
      const basePrice = this.transform('1', poolResponseB);
      const baseAsset = poolResponseB.assets.find(asset => asset.info.native_token?.['denom'] !== 'uusd');
      const [assetA, assetB] = poolResponse.assets[0].info.token?.['contract_addr'] === baseAsset.info.token?.['contract_addr']
        ? [poolResponse.assets[0], poolResponse.assets[1]]
        : [poolResponse.assets[1], poolResponse.assets[0]];
      const assetPerBaseAsset = div(assetA.amount, assetB.amount);
      return new BigNumber(value)
        .times(assetPerBaseAsset)
        .times(basePrice)
        .toString();
    } else {
      return null;
    }

  }

}
