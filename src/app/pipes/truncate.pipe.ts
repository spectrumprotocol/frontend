import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate'
})
export class TruncatePipe implements PipeTransform {

  transform(value: string, h = 6, t = 6): string {
    if (!value) {
      return;
    }
    const head = value.slice(0, h);
    const tail = value.slice(-1 * t, value.length);
    return value.length > h + t ? [head, tail].join('...') : value;
  }

}
