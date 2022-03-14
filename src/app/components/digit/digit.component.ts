import { AfterContentInit, Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-digit',
  templateUrl: './digit.component.html',
  styleUrls: ['./digit.component.scss']
})
export class DigitComponent implements AfterContentInit, OnChanges {

  @Input()
  value: number;

  @Input()
  format = '1.2-2';

  @Input()
  duration = 1000;

  runningValue = 0;

  private counterFunc(endValue: number, durationMs: number) {
    const stepCount = Math.abs(durationMs / 12);
    const valueIncrement = (endValue - this.runningValue) / stepCount;
    const sinValueIncrement = Math.PI / stepCount;

    let currentValue = this.runningValue;
    let currentSinValue = 0;

    const step = () => {
      currentSinValue += sinValueIncrement;
      currentValue += valueIncrement * Math.sin(currentSinValue) ** 2 * 2;

      this.runningValue = currentValue;

      if (currentSinValue < Math.PI) {
        window.requestAnimationFrame(step);
      } else {
        this.runningValue = this.value;
      }
    };

    step();
  }

  ngAfterContentInit() {
    if (this.value) {
      if (document.hidden){
        this.runningValue = this.value;
      } else {
        this.counterFunc(this.value, this.duration);
      }
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value']) {
      if (document.hidden){
        this.runningValue = this.value;
      } else {
        this.counterFunc(this.value, this.duration);
      }
    }
  }
}
