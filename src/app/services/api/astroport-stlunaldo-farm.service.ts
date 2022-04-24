import {Injectable} from '@angular/core';
import {ExecuteOptions, TerrajsService} from '../terrajs.service';
import {ConfigInfo} from './astroport_weldo_stluna_farm/config_info';
import {ExecuteMsg} from './astroport_weldo_stluna_farm/execute_msg';
import {PoolsResponse} from './astroport_weldo_stluna_farm/pools_response';
import {QueryMsg} from './astroport_weldo_stluna_farm/query_msg';
import {RewardInfoResponse} from './astroport_weldo_stluna_farm/reward_info_response';
import {StateInfo} from './astroport_weldo_stluna_farm/state_info';
import {WasmService} from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class AstroportStlunaLdoFarmService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) {
  }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { pools: unknown }>): Promise<PoolsResponse>;
  query(msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.astroportStlunaLdoFarm, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.astroportStlunaLdoFarm, msg, opts);
  }
}
