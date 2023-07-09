import { Injectable } from '@angular/core';
import { Coin, Coins, MsgExecuteContract, MsgInstantiateContract, MsgMigrateContract, MsgStoreCode, MsgUpdateContractAdmin } from '@terra-money/terra.js';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';

@Injectable({
  providedIn: 'root'
})
export class WasmService {

  constructor(
    public terrajs: TerrajsService,
  ) { }

  query(contract: string, msg: object): Promise<any> {
    if (this.terrajs.USE_NEW_BASE64_API) {
      return this.terrajs.get(`cosmwasm/wasm/v1/contract/${contract}/smart/` + Buffer.from(JSON.stringify(msg), 'utf-8').toString('base64'));
      // return this.terrajs.lcdClient.wasm.contractQuery(contract, msg);
      // return this.terrajs.get(`terra/wasm/v1/contracts/${contract}/store`,
      //   { query_msg: Buffer.from(JSON.stringify(msg), 'utf-8').toString('base64') });
    } else {
      return this.terrajs.get(`wasm/contracts/${contract}/store`, { query_msg: JSON.stringify(msg) });
    }
  }

  storeCode(byteCode: string) {
    return this.terrajs.post(new MsgStoreCode(
      this.terrajs.address,
      byteCode
    ));
  }

  instantiate(codeId: number, initMsg: object, opts?: ExecuteOptions) {
    return this.terrajs.post(new MsgInstantiateContract(
      this.terrajs.address,
      this.terrajs.address,
      codeId,
      initMsg,
      new Coins(opts?.coin ? [Coin.fromData(opts.coin)] : [])
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

  migrate(contract: string, newCodeId: number, migrateMsg: object) {
    return this.terrajs.post(new MsgMigrateContract(
      this.terrajs.address,
      contract,
      newCodeId,
      migrateMsg,
    ));
  }

  updateOwner(contract: string, newOwner: string) {
    return this.terrajs.post(new MsgUpdateContractAdmin(
      this.terrajs.address,
      newOwner,
      contract
    ));
  }
}
