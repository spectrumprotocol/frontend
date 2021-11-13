import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ExecuteMsg } from './staker/execute_msg';
import { WasmService } from './wasm.service';
import {QueryMsg} from './nexus_staking/query_msg';
import {ConfigInfo} from './staker/config_info';

@Injectable({
  providedIn: 'root'
})
export class StakerService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.staker, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.staker, msg, opts);
  }
}
