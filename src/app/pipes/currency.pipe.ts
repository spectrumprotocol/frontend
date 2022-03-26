import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currency'
})
export class CurrencyPipe implements PipeTransform {

  transform(value: string) {
    if (!value) {
      return undefined;
    }
    if (value === 'uluna') {
      return 'LUNA';
    }
    return value.slice(1, value.length - 1).toUpperCase() + 'T';
  }

}
