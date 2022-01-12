import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigResponse } from './astroport_generator/config_response';
import { ExecuteMsg } from './astroport_generator/execute_msg';
import { PairsResponse } from './astroport_generator/pairs_response';
import { PairInfo } from './astroport_generator/pair_info';
import { QueryMsg } from './astroport_generator/query_msg';
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
    return this.wasm.query(this.terrajs.settings.astroportGenerator, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.astroportGenerator, msg, opts);
  }
}
