import { Injectable } from '@angular/core';
import { memoize } from 'utils-decorators';
import { ExecuteOptions, TerrajsService } from '../terrajs.service';
import { BalanceResponse } from './gov/balance_response';
import { ConfigInfo } from './gov/config_info';
import { ExecuteMsg, Uint128 } from './gov/execute_msg';
import { PollInfo, PollsResponse } from './gov/polls_response';
import { QueryMsg } from './gov/query_msg';
import { StateInfo } from './gov/state_info';
import { VaultsResponse } from './gov/vaults_response';
import { VotersResponse } from './gov/voters_response';
import { WasmService } from './wasm.service';

@Injectable({
  providedIn: 'root'
})
export class GovService {

  constructor(
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) { }

  balance(address?: string) {
    return this.query({
      balance: {
        address: address || this.terrajs.address,
      }
    });
  }

  @memoize(1000)
  config() {
    return this.query({ config: {} });
  }

  @memoize(1000)
  vaults() {
    return this.query({ vaults: {} });
  }

  state() {
    return this.query({ state: {} });
  }

  withdraw(amount: Uint128, days: number) {
    return this.handle({ withdraw: { amount, days } });
  }

  updateStake(amount: Uint128, from_days: number, to_days: number) {
    return this.handle({ update_stake: { amount, from_days, to_days } });
  }

  query(msg: Extract<QueryMsg, { balance: unknown }>): Promise<BalanceResponse>;
  query(msg: Extract<QueryMsg, { config: unknown }>): Promise<ConfigInfo>;
  query(msg: Extract<QueryMsg, { poll: unknown }>): Promise<PollInfo>;
  query(msg: Extract<QueryMsg, { polls: unknown }>): Promise<PollsResponse>;
  query(msg: Extract<QueryMsg, { state: unknown }>): Promise<StateInfo>;
  query(msg: Extract<QueryMsg, { vaults: unknown }>): Promise<VaultsResponse>;
  query(msg: Extract<QueryMsg, { voters: unknown }>): Promise<VotersResponse>;
  query(msg: QueryMsg): Promise<any> {
    return this.wasm.query(this.terrajs.settings.gov, msg);
  }

  handle(msg: ExecuteMsg, opts?: ExecuteOptions) {
    return this.wasm.execute(this.terrajs.settings.gov, msg, opts);
  }
}
