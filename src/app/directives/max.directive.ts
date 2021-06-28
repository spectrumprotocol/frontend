import { Directive, Input } from '@angular/core';
import { NG_VALIDATORS, Validator, Validators, AbstractControl } from '@angular/forms';

@Directive({
  selector: 'input[max]',
  providers: [{ provide: NG_VALIDATORS, useExisting: MaxValidator, multi: true }]
})
export class MaxValidator implements Validator {

  private $max: number;
  private onChange: () => void;

  @Input()
  set max(value: number) {
    this.$max = value;
    if (this.onChange) {
      this.onChange();
    }
  }

  validate(control: AbstractControl): { [key: string]: any } {
    if (typeof this.$max === 'string') {
      this.$max = +this.$max;
    }
    return this.$max ? Validators.max(this.$max)(control) : null;
  }

  registerOnValidatorChange(fn: () => void): void { this.onChange = fn; }
}
