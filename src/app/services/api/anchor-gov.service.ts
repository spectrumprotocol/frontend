import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigResponse } from './anchor_gov/config_response';
import { HandleMsg } from './anchor_gov/handle_msg';
import { QueryMsg } from './anchor_gov/query_msg';
import { StakerResponse } from './anchor_gov/staker_response';
import { StateResponse } from './anchor_staking/state_response';
import { WasmService } from './wasm.service';


@Injectable({
  providedIn: 'root'
})
export class AnchorGovService {

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
    return this.wasm.query(this.terrajs.settings.anchorGov, msg);
  }

  handle(msg: HandleMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.anchorGov, msg, opts);
  }
}
