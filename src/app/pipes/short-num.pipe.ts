import { DecimalPipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'shortNum'
})
export class ShortNumPipe implements PipeTransform {

  constructor(
    private num: DecimalPipe
  ) { }

  transform(value: number, digitInfo = '1.0-2') {
    if (typeof value !== 'number') {
      return null;
    }
    if (value < 1e3) {
      return this.num.transform(value, digitInfo);
    }

    const units = 'kM';

    const order = Math.min(Math.floor(Math.log(value) / Math.log(1000)), 2);

    const unitname = units[order - 1];
    const num = value / 1000 ** order;

    // output number remainder + unitname
    return this.num.transform(num, digitInfo) + unitname;
  }

}
