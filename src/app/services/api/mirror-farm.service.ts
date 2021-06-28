import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigInfo } from './mirror_farm/config_info';
import { HandleMsg } from './mirror_farm/handle_msg';
import { PoolsResponse } from './mirror_farm/pools_response';
import { QueryMsg } from './mirror_farm/query_msg';
import { RewardInfoResponse } from './mirror_farm/reward_info_response';
import { StateInfo } from './mirror_farm/state_info';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class MirrorFarmService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { pools: unknown }>): Promise<PoolsResponse>;
  query(msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.mirrorFarm, msg);
  }

  handle(msg: HandleMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.mirrorFarm, msg, opts);
  }
}
