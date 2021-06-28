import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigResponse } from './terraswap_factory/config_response';
import { HandleMsg } from './terraswap_factory/handle_msg';
import { PairsResponse } from './terraswap_factory/pairs_response';
import { PairInfo } from './terraswap_factory/pair_info';
import { QueryMsg } from './terraswap_factory/query_msg';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class TerraSwapFactoryService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigResponse>;
  query(msg: Extract<QueryMsg, { pair: unknown }>): Promise<PairInfo>;
  query(msg: Extract<QueryMsg, { pairs: unknown }>): Promise<PairsResponse>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.terraSwapFactory, msg);
  }

  handle(msg: HandleMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.terraSwapFactory, msg, opts);
  }
}
