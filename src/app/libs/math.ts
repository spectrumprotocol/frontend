import BN from 'bignumber.js';
import { CONFIG } from '../consts/config';

export const plus = (a?: BN.Value, b?: BN.Value): string =>
  new BN(a || 0).plus(b || 0).toString();

export const minus = (a?: BN.Value, b?: BN.Value): string =>
  new BN(a || 0).minus(b || 0).toString();

export const times = (a?: BN.Value, b?: BN.Value): string =>
  new BN(a || 0).times(b || 0).toString();

export const div = (a?: BN.Value, b?: BN.Value): string =>
  new BN(a || 0).div(b || 1).toString();

export const pow = (a: BN.Value, b: BN.Value): string =>
  new BN(a).pow(b).toString();

export const sum = (array: BN.Value[]): string =>
  array.length ? BN.sum.apply(null, array.filter(isFinite)).toString() : '0';

export const min = (array: BN.Value[]): string =>
  BN.min.apply(null, array.filter(isFinite)).toString();

export const max = (array: BN.Value[]): string =>
  BN.max.apply(null, array.filter(isFinite)).toString();

export const ceil = (n: BN.Value): string =>
  new BN(n).integerValue(BN.ROUND_CEIL).toString();

export const floor = (n: BN.Value): string =>
  new BN(n).integerValue(BN.ROUND_FLOOR).toString();

export const abs = (n: BN.Value): string => new BN(n).abs().toString();

/* format */
export const toNumber = (n: BN.Value): number => new BN(n).toNumber();

/* boolean */
export const gt = (a: BN.Value, b: BN.Value): boolean => new BN(a).gt(b);
export const lt = (a: BN.Value, b: BN.Value): boolean => new BN(a).lt(b);
export const gte = (a: BN.Value, b: BN.Value): boolean => new BN(a).gte(b);
export const lte = (a: BN.Value, b: BN.Value): boolean => new BN(a).lte(b);

export const isFinite = (n?: BN.Value): boolean =>
  n != null && new BN(n).isFinite();

export const isInteger = (n?: BN.Value): boolean =>
  n != null && new BN(n).isInteger();


export const floorSixDecimal = (input: BN.Value): string =>
  new BN(input).decimalPlaces(CONFIG.DIGIT, BN.ROUND_FLOOR).toString();


export const roundSixDecimal = (input: BN.Value): string =>
  new BN(input).decimalPlaces(CONFIG.DIGIT, BN.ROUND_HALF_UP).toString();

export const floor18Decimal = (input: BN.Value): string =>
  new BN(input).decimalPlaces(18, BN.ROUND_FLOOR).toString();
