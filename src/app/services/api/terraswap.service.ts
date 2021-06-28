import { Injectable } from '@angular/core';
import { WasmService } from './wasm.service';
import {ExecuteOptions} from '../terrajs.service';
import {QueryMsg} from './terraswap_pair/query_msg';
import {PairInfo} from './terraswap_pair/pair_info';
import {PoolResponse} from './terraswap_pair/pool_response';
import {SimulationResponse} from './terraswap_pair/simulation_response';
import {ReverseSimulationResponse} from './terraswap_pair/reverse_simulation_response';
import {HandleMsg} from './terraswap_pair/handle_msg';

@Injectable({
  providedIn: 'root'
})
export class TerraSwapService {

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

  handle(contract: string, msg: HandleMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(contract, msg, opts);
  }
}
