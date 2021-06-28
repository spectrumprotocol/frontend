import { AfterViewInit, Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-digit',
  templateUrl: './digit.component.html',
  styleUrls: ['./digit.component.scss']
})
export class DigitComponent implements AfterViewInit, OnChanges {

  @Input()
  value: number;

  @Input()
  format = '1.0-2';

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

  ngAfterViewInit() {
    if (this.value) {
      this.counterFunc(this.value, this.duration);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value']) {
      this.counterFunc(this.value, this.duration);
    }
  }
}
