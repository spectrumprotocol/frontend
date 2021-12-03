import { Pipe, PipeTransform } from '@angular/core';
import {div, times} from '../libs/math';
import {CONFIG} from '../consts/config';

@Pipe({
  name: 'shortNumber'
})
export class ShortNumberPipe implements PipeTransform {

  constructor(
  ) { }

  transform(input: number, mode?: string, decimals?: any): any {
    if (input === null) {
      return null;
    }
    if (input === 0) {
      if (mode === 'apy'){
        return '0%';
      }
      return '0';
    }
    if (mode === 'tvl') {
      input = +div(input, decimals ? 10 ** decimals : CONFIG.UNIT);
    } else if (mode === 'apy'){
      input = +(input * 100).toFixed(2);
    }
    const fractionSize = 2;
    let abs = Math.abs(input);
    const rounder = Math.pow(10, fractionSize);
    const isNegative = input < 0;
    let key = '';
    const powers = [
      {key: 'Q', value: Math.pow(10, 15)},
      {key: 'T', value: Math.pow(10, 12)},
      {key: 'B', value: Math.pow(10, 9)},
      {key: 'M', value: Math.pow(10, 6)},
      {key: 'k', value: 1000}
    ];
    for (const item of powers) {
      let reduced = abs / item.value;
      reduced = Math.round(reduced * rounder) / rounder;
      if (reduced >= 1) {
        abs = reduced;
        key = item.key;
        break;
      }
    }
    if (mode === 'apy'){
      key = key + '%';
    }
    return (isNegative ? '-' : '') + abs + key;
  }
}
