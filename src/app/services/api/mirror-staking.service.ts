import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigResponse } from './mirror_staking/config_response';
import { HandleMsg } from './mirror_staking/handle_msg';
import { PoolInfoResponse } from './mirror_staking/pool_info_response';
import { QueryMsg } from './mirror_staking/query_msg';
import { RewardInfoResponse } from './mirror_staking/reward_info_response';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class MirrorStakingService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigResponse>;
  query(msg: Extract<QueryMsg, { pool_info: unknown }>): Promise<PoolInfoResponse>;
  query(msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.mirrorStaking, msg);
  }

  handle(msg: HandleMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.mirrorStaking, msg, opts);
  }
}
