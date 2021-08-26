import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { BoardsResponse } from './platform/boards_response';
import { ConfigInfo } from './platform/config_info';
import { ExecuteMsg } from './platform/execute_msg';
import { PollInfo, PollsResponse } from './platform/polls_response';
import { QueryMsg } from './platform/query_msg';
import { StateInfo } from './platform/state_info';
import { VotersResponse } from './platform/voters_response';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class PlatformService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { boards: unknown }>): Promise<BoardsResponse>;
  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { poll: unknown }>): Promise<PollInfo>;
  query(msg: Extract<QueryMsg, { polls: unknown }>): Promise<PollsResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(msg: Extract<QueryMsg, { voters: unknown }>): Promise<VotersResponse>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.platform, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.platform, msg, opts);
  }
}
