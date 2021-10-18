import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigResponse } from './valkyrie_staking/config_response';
import { ExecuteMsg } from './valkyrie_staking/execute_msg';
import { QueryMsg } from './valkyrie_staking/query_msg';
import { StakerInfoResponse } from './valkyrie_staking/staker_info_response';
import { StateResponse } from './valkyrie_staking/state_response';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class ValkyrieStakingService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateResponse>;
  query(msg: Extract<QueryMsg, { staker_info: unknown }>): Promise<StakerInfoResponse>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.valkyrieStaking, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.valkyrieStaking, msg, opts);
  }
}
