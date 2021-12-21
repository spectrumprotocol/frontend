import { Injectable } from '@angular/core';
import { WasmService } from './wasm.service';
import {ExecuteOptions, TerrajsService} from '../terrajs.service';
import {QueryMsg} from './terraswap_router/query_msg';
import {ConfigResponse} from './terraswap_router/config_response';
import {ExecuteMsg} from './terraswap_router/execute_msg';


@Injectable({
  providedIn: 'root'
})
export class TerraSwapRouterService {

  constructor(
    private wasm: WasmService,
    private terrajs: TerrajsService
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigResponse>;
  query(msg: Extract<QueryMsg, { simulate_swap_operations: unknown }>): Promise<any>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.terraSwapRouter, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.terraSwapRouter, msg, opts);
  }
}
