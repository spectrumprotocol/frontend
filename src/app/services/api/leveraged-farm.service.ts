import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ExecuteMsg } from './leveraged-farm/execute_msg';
import { QueryMsg } from './leveraged-farm/query_msg';
import { State } from './leveraged-farm/state';
import { WasmService } from './wasm.service';
import {PositionInfo} from './leveraged-farm/position_info';

@Injectable({
  providedIn: 'root'
})
export class LeveragedFarmService {

  constructor(
    private wasm: WasmService,
  ) { }

  query(farmAddress: string, msg: Extract<QueryMsg, { state: unknown }>): Promise<State>;
  query(farmAddress: string, msg: Extract<QueryMsg, { position: unknown }>): Promise<PositionInfo>;
  query(farmAddress: string, msg: QueryMsg): Promise<any> {
    return this.wasm.query(farmAddress, msg);
  }

  handle(farmAddress: string, msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(farmAddress, msg, opts);
  }
}
