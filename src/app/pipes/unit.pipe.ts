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

  transform(value: any, digitsInfo?: string) {
    if (value == null) {
      return value;
    }
    return this.decimalPipe.transform(div(value, CONFIG.UNIT), digitsInfo);
  }

}
