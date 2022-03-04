import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigInfo } from './nasset_farm/config_info';
import { ExecuteMsg } from './nasset_farm/execute_msg';
import { PoolsResponse } from './nasset_farm/pools_response';
import { QueryMsg } from './nasset_farm/query_msg';
import { RewardInfoResponse } from './nasset_farm/reward_info_response';
import { StateInfo } from './nasset_farm/state_info';
import { WasmService } from './wasm.service';
import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NassetFarmService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { pools: unknown }>): Promise<PoolsResponse>;
  query(msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.bPsiDPFarm, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.bPsiDPFarm, msg, opts);
  }
}
