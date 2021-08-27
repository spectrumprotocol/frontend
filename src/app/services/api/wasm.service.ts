import { Injectable } from '@angular/core';
import { Coin, Coins, MsgExecuteContract, MsgInstantiateContract, MsgMigrateContract, MsgUpdateContractOwner } from '@terra-money/terra.js';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';

@Injectable({
  providedIn: 'root'
})
export class WasmService {

  constructor(
    private terrajs: TerrajsService,
  ) { }

  query(contract: string, msg: object) {
    return this.terrajs.get(`wasm/contracts/${contract}/store`, { query_msg: JSON.stringify(msg) });
  }

  rawQuery(contract: string, key: string, subKey?: string) {
    return this.terrajs.get(`wasm/contracts/${contract}/store/raw`, { key, subKey });
  }

  instantiate(codeId: number, initMsg: object, sender: string, admin: string, migratable?: boolean, opts?: ExecuteOptions) {
    return this.terrajs.post(new MsgInstantiateContract(
      this.terrajs.address,
      codeId,
      initMsg,
      new Coins(opts?.coin ? [Coin.fromData(opts.coin)] : []),
      migratable,
      sender,
      admin
    ));
  }

  execute(contract: string, msg: object, opts?: ExecuteOptions) {
    return this.terrajs.post(new MsgExecuteContract(
      this.terrajs.address,
      contract,
      msg,
      new Coins(opts?.coin ? [Coin.fromData(opts.coin)] : [])
    ));
  }

  migrate(contract: string, newCodeId: number, migrateMsg: object, admin: string) {
    return this.terrajs.post(new MsgMigrateContract(
      this.terrajs.address,
      contract,
      newCodeId,
      migrateMsg,
      admin
    ));
  }

  updateOwner(contract: string, newOwner: string) {
    return this.terrajs.post(new MsgUpdateContractOwner(
      this.terrajs.address,
      newOwner,
      contract
    ));
  }
}
