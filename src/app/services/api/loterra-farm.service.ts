import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigInfo } from './loterra_farm/config_info';
import { ExecuteMsg } from './loterra_farm/execute_msg';
import { PoolsResponse } from './loterra_farm/pools_response';
import { QueryMsg } from './loterra_farm/query_msg';
import { StateInfo } from './loterra_farm/state_info';
import { WasmService } from './wasm.service';
import { RewardInfoResponse } from './loterra_farm/reward_info_response';

@Injectable({
  providedIn: 'root'
})
export class LoterraFarmService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { pools: unknown }>): Promise<PoolsResponse>;
  query(msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.loterraFarm, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.loterraFarm, msg, opts);
  }
}
