import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { AllowanceResponse } from './token/allowance_response';
import { AllAccountsResponse } from './token/all_accounts_response';
import { AllAllowancesResponse } from './token/all_allowances_response';
import { BalanceResponse } from './token/balance_response';
import { ExecuteMsg } from './token/execute_msg';
import { MinterResponse } from './token/minter_response';
import { QueryMsg } from './token/query_msg';
import { TokenInfoResponse } from './token/token_info_response';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class TokenService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  balance(contract: string, address?: string) {
    return this.query(contract, {
      balance: {
        address: address || this.terrajs.address
      }
    });
  }

  query(contract: string, msg: Extract<QueryMsg, { balance: unknown }>): Promise<BalanceResponse>;
  query(contract: string, msg: Extract<QueryMsg, { token_info: unknown }>): Promise<TokenInfoResponse>;
  query(contract: string, msg: Extract<QueryMsg, { minter: unknown }>): Promise<MinterResponse>;
  query(contract: string, msg: Extract<QueryMsg, { allowance: unknown }>): Promise<AllowanceResponse>;
  query(contract: string, msg: Extract<QueryMsg, { all_allowances: unknown }>): Promise<AllAllowancesResponse>;
  query(contract: string, msg: Extract<QueryMsg, { all_accounts: unknown }>): Promise<AllAccountsResponse>;
  query(contract: string, msg: QueryMsg): Promise<any> {
    return this.wasm.query(contract, msg);
  }

  handle(contract: string, msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(contract, msg, opts);
  }
}
