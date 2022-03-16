import { Injectable } from '@angular/core';
import { TerrajsService } from '../terrajs.service';
import { NameResponse } from './tns_name/name_response';
import { QueryMsg } from './tns_name/query_msg';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class TnsNameService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  query(msg: Extract<QueryMsg, { get_name: unknown }>): Promise<NameResponse>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.tnsReverseRecord, msg);
  }

}
