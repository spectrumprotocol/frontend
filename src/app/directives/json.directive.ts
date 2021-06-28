import { Directive } from '@angular/core';
import { AbstractControl, NG_VALIDATORS, ValidationErrors, Validator } from '@angular/forms';

@Directive({
  selector: '[json]',
  providers: [{ provide: NG_VALIDATORS, useExisting: JsonValidator, multi: true }]
})
export class JsonValidator implements Validator {

  validate(control: AbstractControl): ValidationErrors {
    try {
      const data = JSON.parse(control.value);
      return typeof data === 'object' ? null : { json: true };
    } catch {
      return { json: true };
    }
  }

}
