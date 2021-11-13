import { Injectable } from '@angular/core';
import {WasmService} from './wasm.service';
import {QueryMsg} from './nexus_staking/query_msg';
import {ExecuteMsg} from './nexus_staking/execute_msg';
import {ConfigResponse} from './nexus_staking/config_response';
import {StakerInfoResponse} from './nexus_staking/staker_info_response';
import {StateResponse} from './nexus_staking/state_response';
import {ExecuteOptions, TerrajsService} from '../terrajs.service';

@Injectable({
  providedIn: 'root'
})
export class NlunaPsiStakingService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateResponse>;
  query(msg: Extract<QueryMsg, { staker_info: unknown }>): Promise<StakerInfoResponse>;

  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.nLunaPsiStaking, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.nLunaPsiStaking, msg, opts);
  }
}
