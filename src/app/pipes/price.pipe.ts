import { Pipe, PipeTransform } from '@angular/core';
import { div, times } from '../libs/math';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';
import { InfoService } from '../services/info.service';
import { Denom } from '../consts/denom';
import { CONFIG } from '../consts/config';

@Pipe({
  name: 'price'
})
export class PricePipe implements PipeTransform {

  constructor(
    private info: InfoService,
  ) { }

  transform(key: string) {
    const poolResponse = this.info.poolResponses[key];
    if (!poolResponse) {
      return undefined;
    }
    const baseToken = key.split('|')[1];
    const asset0Token: string = poolResponse.assets[0].info.token
      ? poolResponse.assets[0].info.token?.['contract_addr']
      : poolResponse.assets[0].info.native_token?.['denom'];
    const asset1Token: string = poolResponse.assets[1].info.token
      ? poolResponse.assets[1].info.token?.['contract_addr']
      : poolResponse.assets[1].info.native_token?.['denom'];
    const asset0Decimals = asset0Token.startsWith('u') ? 6 : this.info.tokenInfos[asset0Token]?.decimals || 6;
    const asset1Decimals = asset1Token.startsWith('u') ? 6 : this.info.tokenInfos[asset1Token]?.decimals || 6;
    if (asset0Token === baseToken) {
      return this.toUIPrice(div(poolResponse.assets[1].amount, poolResponse.assets[0].amount),
        asset1Decimals,
        asset0Decimals);
    } else {
      return this.toUIPrice(div(poolResponse.assets[0].amount, poolResponse.assets[1].amount),
        asset0Decimals,
        asset1Decimals);
    }
  }

  private toUIPrice(price: string, offer_decimals: number, ask_decimals: number) {
    return offer_decimals === ask_decimals
      ? price
      : times(price, 10 ** (ask_decimals - offer_decimals));
  }

}
