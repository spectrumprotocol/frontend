import { Pipe, PipeTransform } from '@angular/core';
import BigNumber from 'bignumber.js';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';
import {TerrajsService} from '../services/terrajs.service';
import {Denom} from '../consts/denom';
import {div, times} from '../libs/math';
import {InfoService} from '../services/info.service';

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
    if (poolResponse.assets[0].info.native_token) {
      return new BigNumber(value)
        .times(poolResponse.assets[0].amount)
        .div(poolResponse.assets[1].amount)
        .toString();
    } else if (poolResponse.assets[1].info.native_token) {
      return new BigNumber(value)
        .times(poolResponse.assets[1].amount)
        .div(poolResponse.assets[0].amount)
        .toString();
    } else if (poolResponse.assets[0].info.token && poolResponse.assets[1].info.token){
      const psiPrice = this.transform('1', poolResponseB);
      const nAssetPricePerPsi = div(poolResponse.assets.find(asset => asset?.info?.token['contract_addr'] === this.terrajs.settings.nexusToken).amount,
        poolResponse.assets.find(asset => new Set([this.terrajs.settings.nLunaToken, this.terrajs.settings.nEthToken]).has(asset?.info?.token['contract_addr'])).amount);
      const nAssetPricePerUST = times(nAssetPricePerPsi, psiPrice);
      return new BigNumber(value).times(nAssetPricePerUST).toString();
    } else {
      return null;
    }

  }

}
