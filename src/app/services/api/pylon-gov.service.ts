import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigResponse } from './pylon_gov/config_response';
import { HandleMsg } from './pylon_gov/handle_msg';
import { QueryMsg } from './pylon_gov/query_msg';
import { StakerResponse } from './pylon_gov/staker_response';
import { StateResponse } from './pylon_staking/state_response';
import { WasmService } from './wasm.service';


@Injectable({
  providedIn: 'root'
})
export class PylonGovService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  balance(address?: string) {
    return this.query({
      staker: {
        address: address || this.terrajs.address,
      }
    });
  }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateResponse>;
  query(msg: Extract<QueryMsg, { staker: unknown }>): Promise<StakerResponse>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.pylonGov, msg);
  }

  handle(msg: HandleMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.pylonGov, msg, opts);
  }
}
