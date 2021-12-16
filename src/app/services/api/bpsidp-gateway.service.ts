import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigResponse } from './pylon_staking/config_response';
import { HandleMsg } from './pylon_staking/handle_msg';
import { QueryMsg } from './pylon_staking/query_msg';
import { StakerInfoResponse } from './pylon_staking/staker_info_response';
import { StateResponse } from './pylon_staking/state_response';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class BPsiDpGatewayService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateResponse>;
  query(msg: Extract<QueryMsg, { staker_info: unknown }>): Promise<StakerInfoResponse>;

  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.pylonStaking, msg);
  }

  handle(msg: HandleMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.pylonStaking, msg, opts);
  }
}
