import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigBaseFor_String } from './borrowed_farm/config_base_for__string';
import { ExecuteMsg } from './borrowed_farm/execute_msg';
import { QueryMsg } from './borrowed_farm/query_msg';
import { RewardInfoResponse } from './borrowed_farm/reward_info_response';
import { State } from './borrowed_farm/state';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class SpecBorrowedFarmService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigBaseFor_String>;
  query(msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<State>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.specBorrowedFarm, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.specBorrowedFarm, msg, opts);
  }
}
