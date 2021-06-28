import { Directive, ElementRef, HostListener, Input } from '@angular/core';

@Directive({
  selector: '[step]'
})
export class StepDirective {

  @Input()
  set step(value: number|string) {
    const str = value.toString();
    const i = str.indexOf('.');
    if (i <= 0) {
      this.regex = new RegExp(/^-?\d*$/);
    } else {
      const length = str.length - i - 1;
      this.regex = new RegExp(`^-?\\d*(\\.\\d{0,${length}})?$`);
    }
  }

  // Allow decimal numbers and negative values
  private regex: RegExp;
  // Allow key codes for special events. Reflect :
  // Backspace, tab, end, home
  private specialKeys: Array<string> = [
    'Backspace',
    'Tab',
    'End',
    'Home',
    'ArrowLeft',
    'ArrowRight',
    'Del',
    'Delete'
  ];

  constructor(private el: ElementRef) { }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // Allow Backspace, tab, end, and home keys
    if (this.specialKeys.indexOf(event.key) !== -1) {
      return;
    }
    const current: string = this.el.nativeElement.value;
    const next: string = [
      current.slice(0, this.el.nativeElement.selectionStart),
      event.key === 'Decimal' ? '.' : event.key,
      current.slice(this.el.nativeElement.selectionEnd)
    ].join('');
    if (next && !next.match(this.regex)) {
      event.preventDefault();
    }
  }
}
