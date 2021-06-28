import { Pipe, PipeTransform } from '@angular/core';
import * as timeago from 'timeago.js';

@Pipe({
  name: 'timeago'
})
export class TimeagoPipe implements PipeTransform {

  transform(value: Date) {
    if (!value) {
      return null;
    }
    return timeago.format(value);
  }

}
