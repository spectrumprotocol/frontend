import { Injectable } from '@angular/core';
import {WasmService} from './wasm.service';
import {QueryMsg} from './orion_staking/query_msg';
import {ExecuteMsg} from './orion_staking/execute_msg';
import {ConfigResponse} from './orion_staking/config_response';
import {StakerInfoResponse} from './orion_staking/staker_info_response';
import {StateResponse} from './orion_staking/state_response';
import {ExecuteOptions, TerrajsService} from '../terrajs.service';

@Injectable({
  providedIn: 'root'
})
export class OrionStakingService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateResponse>;
  query(msg: Extract<QueryMsg, { staker_info: unknown }>): Promise<StakerInfoResponse>;

  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.orionStaking, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.orionStaking, msg, opts);
  }
}
