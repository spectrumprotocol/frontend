import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigInfo } from './orion_farm/config_info';
import { ExecuteMsg } from './orion_farm/execute_msg';
import { PoolsResponse } from './orion_farm/pools_response';
import { QueryMsg } from './orion_farm/query_msg';
import { StateInfo } from './orion_farm/state_info';
import { WasmService } from './wasm.service';
import {RewardInfoResponse} from './orion_farm/reward_info_response';

@Injectable({
  providedIn: 'root'
})
export class OrionFarmService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { pools: unknown }>): Promise<PoolsResponse>;
  query(msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.orionFarm, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.orionFarm, msg, opts);
  }
}
