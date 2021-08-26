import { Injectable } from '@angular/core';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { ExecuteMsg } from './staker/execute_msg';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class StakerService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.staker, msg, opts);
  }
}
