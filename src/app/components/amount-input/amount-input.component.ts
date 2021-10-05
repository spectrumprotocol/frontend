import { Component, forwardRef, Input } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { CONFIG } from 'src/app/consts/config';

@Component({
  selector: 'app-amount-input',
  templateUrl: './amount-input.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AmountInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => AmountInputComponent),
      multi: true,
    },
  ],
})
export class AmountInputComponent implements ControlValueAccessor, Validator {
  @Input() symbol: string;
  @Input() balance: bigint;

  placeholder = `0.${'0'.repeat(CONFIG.DIGIT)}`;
  onChange: (value: bigint) => void;
  isInvalid = false;

  private _value = '';
  get value() { return this._value; }
  set value(value) {
    this._value = value;

    try {
      this.onChange(this.decimal2Bigint(value));
    } catch { }
  }

  onInput(event: Event) {
    this.value = (event.target as HTMLInputElement).value;
  }

  setToMax() {
    this.value = this.bigint2Decimal(this.balance);
  }

  writeValue(value: any): void {
    if (typeof value === 'bigint') {
      this.value = this.bigint2Decimal(value);
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(_: any): void { }

  validate(control: AbstractControl): ValidationErrors | null {
    this.isInvalid = control.invalid;

    if (this.value.split('.')[1]?.length > CONFIG.DIGIT) {
      this.isInvalid = true;

      return {
        maxDecimalPlaces: {
          max: CONFIG.DIGIT,
        },
      };
    }

    if (control.value > this.balance) {
      this.isInvalid = true;

      return {
        exceededBalance: {
          balance: this.balance
        },
      };
    }

    return null;
  }

  private bigint2Decimal(value: bigint): string {
    const valueText = value.toString();
    let parts: [string, string];

    if (valueText.length <= CONFIG.DIGIT) {
      parts = ['', valueText];
    } else {
      const pointIndex = valueText.length - CONFIG.DIGIT;
      parts = [valueText.substring(0, pointIndex), valueText.substring(pointIndex)];
    }

    return `${parts[0] || 0}.${parts[1].padStart(CONFIG.DIGIT, '0')}`;
  }

  private decimal2Bigint(value: string): bigint {
    const pointIndex = value.indexOf('.');
    const parts = pointIndex >= 0
      ? [value.substring(0, pointIndex), value.substring(pointIndex + 1)]
      : [value, ''];

    parts[1] = parts[1].substring(0, CONFIG.DIGIT).padEnd(CONFIG.DIGIT, '0');

    return BigInt(parts.join(''));
  }
}
