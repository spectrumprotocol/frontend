import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { BalanceResponse } from './wallet/balance_response';
import { ConfigInfo } from './wallet/config_info';
import { ExecuteMsg } from './wallet/execute_msg';
import { QueryMsg } from './wallet/query_msg';
import { SharesResponse } from './wallet/shares_response';
import { StateInfo } from './wallet/state_info';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class WalletService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  balance(contract: string, address: string) {
    return this.query(contract, {
      balance: {
        address: address || this.terrajs.address,
      }
    });
  }

  query(contract: string, msg: Extract<QueryMsg, { balance: unknown }>): Promise<BalanceResponse>;
  query(contract: string, msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(contract: string, msg: Extract<QueryMsg, { shares: unknown }>): Promise<SharesResponse>;
  query(contract: string, msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(contract: string, msg: QueryMsg): Promise<any> {
    return this.wasm.query(contract, msg);
  }

  handle(contract: string, msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(contract, msg, opts);
  }
}
