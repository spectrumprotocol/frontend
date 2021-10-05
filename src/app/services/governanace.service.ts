import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { StateInfo } from 'src/app/services/api/gov/state_info';
import { toBase64 } from '../libs/base64';
import { GovService } from './api/gov.service';
import { BalanceResponse } from './api/gov/balance_response';
import { TokenService } from './api/token.service';
import { TerrajsService } from './terrajs.service';

@Injectable({
  providedIn: 'root',
})
export class GovernanceService {
  constructor(
    private terrajsService: TerrajsService,
    private govService: GovService,
    private tokenService: TokenService) { }

  getState(): Observable<StateInfo> {
    return from(this.govService.state());
  }

  getBalance(): Observable<BalanceResponse> {
    return from(this.govService.balance());
  }

  deposit(amount: bigint, days: number): Observable<void> {
    return from(this.tokenService.handle(this.terrajsService.settings.specToken, {
      send: {
        amount: amount.toString(),
        contract: this.terrajsService.settings.gov,
        msg: toBase64({ stake_tokens: { days } }),
      },
    }));
  }

  withdraw(amount: bigint, days: number): Observable<void> {
    return from(this.govService.withdraw(amount.toString(), days));
  }

  move(amount: bigint, fromDays: number, toDays: number): Observable<void> {
    return from(this.govService.updateStake(amount.toString(), fromDays, toDays));
  }
}
