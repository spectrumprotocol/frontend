import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ConfigBaseFor_String } from './borrowed-farm/config_base_for__string';
import { ExecuteMsg } from './borrowed-farm/execute_msg';
import { QueryMsg } from './borrowed-farm/query_msg';
import { RewardInfoResponse } from './borrowed-farm/reward_info_response';
import { State } from './borrowed-farm/state';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class BorrowedFarmService {

  constructor(
    private wasm: WasmService,
  ) { }

  query(farmAddress: string, msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigBaseFor_String>;
  query(farmAddress: string, msg: Extract<QueryMsg, { state: unknown }>): Promise<State>;
  query(farmAddress: string, msg: Extract<QueryMsg, { reward_info: unknown }>): Promise<RewardInfoResponse>;

  query(farmAddress: string, msg: QueryMsg): Promise<any> {
    return this.wasm.query(farmAddress, msg);
  }

  handle(farmAddress: string, msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(farmAddress, msg, opts);
  }
}
