import BigNumber from 'bignumber.js';
import { Injectable } from '@angular/core';
import { div, floor, gt, pow, times } from '../libs/math';
import { CONFIG } from '../consts/config';

export interface TaxResult {
  height: string;
  result: string;
}

export interface Asset {
  amount: string;
  token: string;
  symbol?: string;
}

const DECIMAL18 = pow(10, 18);

@Injectable({
  providedIn: 'root'
})
export class CalcService {

  minimumReceived(
    offer_amount: string,
    belief_price: string,
    max_spread: string,
    commission: string
  ) {
    const expectedAmount = new BigNumber(offer_amount).div(belief_price);
    const rate1 = new BigNumber(1).minus(max_spread);
    const rate2 = new BigNumber(1).minus(commission);
    return expectedAmount.times(rate1).times(rate2).toString();
  }

  floorSixDecimal(input: string): string {
    return div(floor(times(input, CONFIG.UNIT)), CONFIG.UNIT);
  }

  roundSixDecimal(input: string): string {
    return new BigNumber(input)
      .times(CONFIG.UNIT)
      .integerValue(BigNumber.ROUND_HALF_UP)
      .div(CONFIG.UNIT)
      .toString();
  }

  floor18Decimal(input: string): string {
    return div(floor(times(input, DECIMAL18)), DECIMAL18);
  }

  /**
   * to LP
   * @param deposits[].amount - Amount to provide
   * @param deposits[].pair - pair, {pool:{}}
   * @param totalShare - pair, {pool:{}}
   */
  toLP(deposits: { amount: string; pair: string }[], totalShare: string) {
    return gt(totalShare, 0)
      ? BigNumber.minimum(
        ...deposits.map(({ amount, pair }) =>
          new BigNumber(amount).times(totalShare).div(pair)
        )
      ).toString()
      : new BigNumber(deposits[0].amount)
        .times(deposits[1].amount)
        .sqrt()
        .toString();
  }

  /**
   * from LP
   * @param lp - Amount to withdraw
   * @param shares - pair, {pool:{}}
   * @param totalShare - pair, {pool:{}}
   */
  fromLP(
    lp: string,
    shares: { asset: Asset; uusd: Asset },
    totalShare: string): { asset: Asset; uusd: Asset } {
    return Object.entries(shares).reduce(
      (acc, [key, { amount, token }]) => ({
        ...acc,
        [key]: {
          amount: new BigNumber(lp).times(amount).div(totalShare).toString(),
          token,
        },
      }),
      {} as { asset: Asset; uusd: Asset }
    );
  }
}

