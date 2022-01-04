import { DecimalPipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { CONFIG } from '../consts/config';
import { div } from '../libs/math';

@Pipe({
  name: 'unit'
})
export class UnitPipe implements PipeTransform {

  constructor(
    private decimalPipe: DecimalPipe
  ) { }

  transform(value: any, decimals?: number, digitsInfo?: string) {
    if (value == null) {
      return value;
    }
    return this.decimalPipe.transform(div(value, decimals ? 10 ** decimals : CONFIG.UNIT), !digitsInfo && decimals ? `1.0-${decimals}` : digitsInfo );
  }

}
