import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'jsonParse'
})
export class JsonParsePipe implements PipeTransform {

  transform(value: string): unknown {
    if (!value) {
      return null;
    }
    return JSON.parse(value);
  }

}
