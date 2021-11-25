import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigInfo } from './nexus_nassets_psi_farm/config_info';
import { ExecuteMsg } from './nexus_nassets_psi_farm/execute_msg';
import { PoolsResponse } from './nexus_nassets_psi_farm/pools_response';
import { QueryMsg } from './nexus_nassets_psi_farm/query_msg';
import { StateInfo } from './nexus_nassets_psi_farm/state_info';
import { WasmService } from './wasm.service';
import {RewardInfoResponse} from './nexus_nassets_psi_farm/reward_info_response';

@Injectable({
  providedIn: 'root'
})
export class NethPsiFarmService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { pools: unknown }>): Promise<PoolsResponse>;
  query(msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.nEthPsiFarm, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.nEthPsiFarm, msg, opts);
  }
}
