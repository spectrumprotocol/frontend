import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigInfo } from './luna_burn_farm/config_info';
import { ExecuteMsg } from './luna_burn_farm/execute_msg';
import { Hub } from './luna_burn_farm/hub';
import { QueryMsg } from './luna_burn_farm/query_msg';
import { RewardInfoResponse } from './luna_burn_farm/reward_info_response';
import { Burn, SimulateCollectResponse } from './luna_burn_farm/simulate_collect_response';
import { State } from './luna_burn_farm/state';
import { Unbonding } from './luna_burn_farm/unbonding';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class LunaBurnFarmService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(msg: Extract<QueryMsg, { unbond: unknown }>): Promise<Unbonding[]>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<State>;
  query(msg: Extract<QueryMsg, { hubs: unknown }>): Promise<Hub[]>;
  query(msg: Extract<QueryMsg, { burns: unknown }>): Promise<Burn[]>;
  query(msg: Extract<QueryMsg, { simulate_collect: unknown }>): Promise<SimulateCollectResponse>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.lunaBurnFarm, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.lunaBurnFarm, msg, opts);
  }
}
