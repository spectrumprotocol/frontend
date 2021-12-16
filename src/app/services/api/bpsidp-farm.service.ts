import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigInfo } from './pylon_liquid_farm/config_info';
import { ExecuteMsg } from './pylon_liquid_farm/execute_msg';
import { PoolsResponse } from './pylon_liquid_farm/pools_response';
import { QueryMsg } from './pylon_liquid_farm/query_msg';
import { RewardInfoResponse } from './pylon_liquid_farm/reward_info_response';
import { StateInfo } from './pylon_liquid_farm/state_info';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class BPsiDpFarmService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { pools: unknown }>): Promise<PoolsResponse>;
  query(msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.bPsiDPFarm, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.bPsiDPFarm, msg, opts);
  }
}
