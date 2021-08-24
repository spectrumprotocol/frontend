import BigNumber from 'bignumber.js';
import { Injectable } from '@angular/core';
import { gt } from '../libs/math';

export interface TaxResult {
  height: string;
  result: string;
}

export interface Asset {
  amount: string;
  token: string;
  symbol?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CalcService {

  minimumReceived(
    offer_amount: BigNumber.Value,
    belief_price: BigNumber.Value,
    max_spread: BigNumber.Value,
    commission: BigNumber.Value
  ) {
    const expectedAmount = new BigNumber(offer_amount).div(belief_price);
    const rate1 = new BigNumber(1).minus(max_spread);
    const rate2 = new BigNumber(1).minus(commission);
    return expectedAmount.times(rate1).times(rate2).toString();
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

