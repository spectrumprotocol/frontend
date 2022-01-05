import { Pipe, PipeTransform } from '@angular/core';
import { div, times } from '../libs/math';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';
import { InfoService } from '../services/info.service';
import {Denom} from '../consts/denom';
import {CONFIG} from '../consts/config';

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
    if (key === `Astroport|${Denom.LUNA}|${Denom.USD}`){
      const [lunaAsset, uusdAsset] = poolResponse.assets[0].info.native_token?.['denom'] === Denom.USD
        ? [poolResponse.assets[1], poolResponse.assets[0]]
        : [poolResponse.assets[0], poolResponse.assets[1]];
      return this.toUIPrice(div(uusdAsset.amount, lunaAsset.amount),
        CONFIG.DIGIT, CONFIG.DIGIT);
    }
    const baseToken = key.split('|')[1];
    if (poolResponse.assets[0].info.token?.['contract_addr'] === baseToken) {
      return this.toUIPrice(div(poolResponse.assets[1].amount, poolResponse.assets[0].amount),
        poolResponse.assets[1].info.native_token ? 6 : this.info.tokenInfos[poolResponse.assets[1].info.token['contract_addr']]?.decimals || 6,
        this.info.tokenInfos[baseToken].decimals);
    } else {
      return this.toUIPrice(div(poolResponse.assets[0].amount, poolResponse.assets[1].amount),
        poolResponse.assets[0].info.native_token ? 6 : this.info.tokenInfos[poolResponse.assets[0].info.token['contract_addr']]?.decimals || 6,
        this.info.tokenInfos[baseToken].decimals);
    }
  }

  private toUIPrice(price: string, offer_decimals: number, ask_decimals: number) {
    return offer_decimals === ask_decimals
      ? price
      : times(price, 10 ** (ask_decimals - offer_decimals));
  }

}
