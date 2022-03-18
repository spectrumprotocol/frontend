import { Injectable } from '@angular/core';
import { Coin, Coins, MsgSend } from '@terra-money/terra.js';
import { APIParams, PaginationOptions } from '@terra-money/terra.js/dist/client/lcd/APIRequester';
import { TerrajsService } from '../terrajs.service';

@Injectable({
  providedIn: 'root'
})
export class BankService {

  constructor(
    private terrajs: TerrajsService,
  ) { }

  async balances(address?: string, pagination?: Partial<PaginationOptions & APIParams>): Promise<Coins> {
    // tslint:disable-next-line:prefer-const
    let [coins, pager] = await this.terrajs.lcdClient.bank.balance(address || this.terrajs.address, pagination);
    if (pager.next_key) {
      const next_coins = await this.balances(address, { 'pagination.key': pager.next_key });
      coins = coins.add(next_coins);
    }
    return coins;
  }

  // transfers(value: { from_address?: string; to_address: string; amount: Coin.Data[] }) {
  //   return this.terrajs.post(MsgSend.fromData({
  //     type: 'bank/MsgSend',
  //     value: {
  //       from_address: this.terrajs.address,
  //       ...value
  //     }
  //   }));
  // }
}
