import { Injectable } from '@angular/core';
import { Coin, Coins, MsgSend } from '@terra-money/terra.js';
import { TerrajsService } from '../terrajs.service';

@Injectable({
  providedIn: 'root'
})
export class BankService {

  constructor(
    private terrajs: TerrajsService,
  ) { }

  balances(address?: string) {
    return this.terrajs.get('bank/balances/' + (address || this.terrajs.address))
      .then(it => Coins.fromData(it));
  }

  transfers(value: { from_address?: string; to_address: string; amount: Coin.Data[] }) {
    return this.terrajs.post(MsgSend.fromData({
      type: 'bank/MsgSend',
      value: {
        from_address: this.terrajs.address,
        ...value
      }
    }));
  }
}
