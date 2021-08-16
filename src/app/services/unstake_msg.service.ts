import { Injectable, OnDestroy } from '@angular/core';
import {TerrajsService} from './terrajs.service';
import {MsgExecuteContract} from '@terra-money/terra.js';

@Injectable({
  providedIn: 'root'
})
export class UnstakeMsgService{
  constructor(
    private terrajs: TerrajsService
  ) {

  }

  generateMintMsg(){
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.gov,
      {
        mint: {}
      }
    );
  }

  generateWithdrawMsg(farm: string, all?: boolean, asset_token?: string){
    let contractAddress;
    switch (farm){
      case 'Mirror':
        contractAddress = this.terrajs.settings.mirrorFarm;
        break;
      case 'Spectrum':
        contractAddress = this.terrajs.settings.specFarm;
        break;
      case 'Anchor':
        contractAddress = this.terrajs.settings.anchorFarm;
        break;
      case 'Pylon':
        contractAddress = this.terrajs.settings.pylonFarm;
        break;
    }
    return new MsgExecuteContract(
      this.terrajs.address,
      contractAddress,
      {
        withdraw: {
          asset_token: all ? undefined : asset_token,
        }
      }
    );
  }





}
