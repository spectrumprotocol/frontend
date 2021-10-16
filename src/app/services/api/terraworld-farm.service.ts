import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigInfo } from './terraworld_farm/config_info';
import { ExecuteMsg } from './terraworld_farm/execute_msg';
import { PoolsResponse } from './terraworld_farm/pools_response';
import { QueryMsg } from './terraworld_farm/query_msg';
import { RewardInfoResponse } from './terraworld_farm/reward_info_response';
import { StateInfo } from './terraworld_farm/state_info';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class TerraworldFarmService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { pools: unknown }>): Promise<PoolsResponse>;
  query(msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.terraworldFarm, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.terraworldFarm, msg, opts);
  }
}
