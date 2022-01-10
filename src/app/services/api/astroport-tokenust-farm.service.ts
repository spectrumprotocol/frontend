import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigInfo } from './astroport_farm/config_info';
import { ExecuteMsg } from './astroport_farm/execute_msg';
import { PoolsResponse } from './astroport_farm/pools_response';
import { QueryMsg } from './astroport_farm/query_msg';
import { RewardInfoResponse } from './astroport_farm/reward_info_response';
import { StateInfo } from './astroport_farm/state_info';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class AstroportTokenUstFarmService {

  constructor(
    private wasm: WasmService,
  ) { }

  query(farmAddress: string, msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(farmAddress: string, msg: Extract<QueryMsg, { pools: unknown }>): Promise<PoolsResponse>;
  query(farmAddress: string, msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(farmAddress: string, msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(farmAddress: string, msg: QueryMsg): Promise<any> {
    return this.wasm.query(farmAddress, msg);
  }

  handle(farmAddress: string, msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(farmAddress, msg, opts);
  }
}
