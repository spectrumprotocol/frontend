import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigInfo } from './astroport_luna_ust_farm/config_info';
import { ExecuteMsg } from './astroport_luna_ust_farm/execute_msg';
import { PoolsResponse } from './astroport_luna_ust_farm/pools_response';
import { QueryMsg } from './astroport_luna_ust_farm/query_msg';
import { RewardInfoResponse } from './astroport_luna_ust_farm/reward_info_response';
import { StateInfo } from './astroport_luna_ust_farm/state_info';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class AstroportLunaUstFarmService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { pools: unknown }>): Promise<PoolsResponse>;
  query(msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.astroportLunaUstFarm, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.astroportLunaUstFarm, msg, opts);
  }
}
