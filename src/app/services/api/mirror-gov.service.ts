import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigResponse } from './mirror_gov/config_response';
import { HandleMsg } from './mirror_gov/handle_msg';
import { PollResponse, PollsResponse } from './mirror_gov/polls_response';
import { QueryMsg } from './mirror_gov/query_msg';
import { StakerResponse } from './mirror_gov/staker_response';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class MirrorGovService {

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
  query(msg: Extract<QueryMsg, { poll: unknown }>): Promise<PollResponse>;
  query(msg: Extract<QueryMsg, { polls: unknown }>): Promise<PollsResponse>;
  query(msg: Extract<QueryMsg, { staker: unknown }>): Promise<StakerResponse>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.mirrorGov, msg);
  }

  handle(msg: HandleMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.mirrorGov, msg, opts);
  }
}
