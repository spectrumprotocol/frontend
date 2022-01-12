import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigResponse } from './astroport_factory/config_response';
import { ExecuteMsg } from './astroport_factory/execute_msg';
import { PairsResponse } from './astroport_factory/pairs_response';
import { PairInfo } from './astroport_factory/pair_info';
import { QueryMsg } from './astroport_factory/query_msg';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class AstroportFactoryService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigResponse>;
  query(msg: Extract<QueryMsg, { pair: unknown }>): Promise<PairInfo>;
  query(msg: Extract<QueryMsg, { pairs: unknown }>): Promise<PairsResponse>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.astroportFactory, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.astroportFactory, msg, opts);
  }
}
