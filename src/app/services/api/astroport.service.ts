import { Injectable } from '@angular/core';
import { WasmService } from './wasm.service';
import {ExecuteOptions} from '../terrajs.service';
import {QueryMsg} from './astroport_pair/query_msg';
import {PairInfo} from './astroport_pair/pair_info';
import {PoolResponse} from './astroport_pair/pool_response';
import {SimulationResponse} from './astroport_pair/simulation_response';
import {ReverseSimulationResponse} from './astroport_pair/reverse_simulation_response';
import {ExecuteMsg} from './astroport_pair/execute_msg';

@Injectable({
  providedIn: 'root'
})
export class AstroportService {

  constructor(
    private wasm: WasmService,
  ) { }

  query(contract: string, msg: Extract<QueryMsg, { pair: unknown }>): Promise<PairInfo>;
  query(contract: string, msg: Extract<QueryMsg, { pool: unknown }>): Promise<PoolResponse>;
  query(contract: string, msg: Extract<QueryMsg, { simulation: unknown }>): Promise<SimulationResponse>;
  query(contract: string, msg: Extract<QueryMsg, { reverse_simulation: unknown }>): Promise<ReverseSimulationResponse>;
  query(contract: string, msg: QueryMsg): Promise<any> {
    return this.wasm.query(contract, msg);
  }

  handle(contract: string, msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(contract, msg, opts);
  }
}
