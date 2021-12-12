import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { BorrowerInfosResponse } from './anchor_market/borrower_infos_response';
import { BorrowerInfoResponse } from './anchor_market/borrower_info_response';
import { ConfigResponse } from './anchor_market/config_response';
import { EpochStateResponse } from './anchor_market/epoch_state_response';
import { ExecuteMsg } from './anchor_market/execute_msg';
import { QueryMsg } from './anchor_market/query_msg';
import { State } from './anchor_market/state';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class AnchorMarketService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<State>;
  query(msg: Extract<QueryMsg, { epoch_state: unknown }>): Promise<EpochStateResponse>;
  query(msg: Extract<QueryMsg, { borrower_info: unknown }>): Promise<BorrowerInfoResponse>;
  query(msg: Extract<QueryMsg, { borrower_infos: unknown }>): Promise<BorrowerInfosResponse>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.anchorMarket, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.anchorMarket, msg, opts);
  }
}
