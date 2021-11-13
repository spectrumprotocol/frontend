import { Pipe, PipeTransform } from '@angular/core';
import BigNumber from 'bignumber.js';
import { PoolResponse } from '../services/api/terraswap_pair/pool_response';
import {TerrajsService} from '../services/terrajs.service';
import {times} from '../libs/math';
import {BalancePipe} from './balance.pipe';

@Pipe({
  name: 'lpBalance'
})
export class LpBalancePipe implements PipeTransform {

  constructor(
    private terrajs: TerrajsService,
    private balancePipe: BalancePipe
  ){}

    transform(lp: any, poolResponses: Record<string, PoolResponse>, asset_token: string): string {
    if ((typeof lp !== 'string' && typeof lp !== 'number') || !poolResponses[asset_token]) {
      return undefined;
    }
    if (poolResponses[asset_token].assets[0].info.native_token) {
      return new BigNumber(lp)
        .times(poolResponses[asset_token].assets[0].amount)
        .div(poolResponses[asset_token].total_share)
        .times(2)
        .toString();
    } else if (poolResponses[asset_token].assets[1].info.native_token){
      return new BigNumber(lp)
        .times(poolResponses[asset_token].assets[1].amount)
        .div(poolResponses[asset_token].total_share)
        .times(2)
        .toString();
    } else if (asset_token === this.terrajs.settings.nLunaToken || asset_token === this.terrajs.settings.nEthToken) {
      let index;
      let asset_address;
      if (poolResponses[asset_token].assets[0].info.token['contract_addr'] === this.terrajs.settings.nLunaToken && poolResponses[asset_token].assets[1].info.token['contract_addr'] === this.terrajs.settings.nexusToken){
        index = 1;
        asset_address = this.terrajs.settings.nLunaToken;
      } else if (poolResponses[asset_token].assets[1].info.token['contract_addr'] === this.terrajs.settings.nLunaToken && poolResponses[asset_token].assets[0].info.token['contract_addr'] === this.terrajs.settings.nexusToken){
        index = 0;
        asset_address = this.terrajs.settings.nLunaToken;
      } else if (poolResponses[asset_token].assets[0].info.token['contract_addr'] === this.terrajs.settings.nEthToken && poolResponses[asset_token].assets[1].info.token['contract_addr'] === this.terrajs.settings.nexusToken){
        index = 1;
        asset_address = this.terrajs.settings.nEthToken;
      } else if (poolResponses[asset_token].assets[1].info.token['contract_addr'] === this.terrajs.settings.nEthToken && poolResponses[asset_token].assets[0].info.token['contract_addr'] === this.terrajs.settings.nexusToken){
        index = 0;
        asset_address = this.terrajs.settings.nEthToken;
      } else {
        return null;
      }
      const psiPrice = this.balancePipe.transform('1', poolResponses[this.terrajs.settings.nexusToken]);
      const psiAmount = new BigNumber(lp)
        .times(poolResponses[asset_address].assets[index].amount)
        .div(poolResponses[asset_address].total_share).toString();
      const totalPsiValueUST = times(psiPrice, psiAmount);
      return times(totalPsiValueUST, 2).toString();
    } else {
      return null;
    }
  }
}
