import {Denom} from './denom';

export const CONFIG = {
  DIGIT: 6,
  UNIT: 1000000,  // 10^DIGIT
  TERRASWAP_COMMISSION: '0.003', // https://docs.terraswap.io/docs/introduction/trading_fees/
  ASTROPORT_COMMISSION: '0.003',
  GOOGLE_ANALYTICS_ID: 'G-LVNNNLJ9S6',
  SLIPPAGE_TOLERANCE: '0.01',
  NATIVE_TOKENS: [Denom.USD, 'uluna']
};
