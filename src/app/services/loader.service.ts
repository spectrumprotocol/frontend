import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  state: LoaderState = { loading: false, counter: 0 };
  update = new BehaviorSubject(this.state);

  enterLoad(value?: any) {
    this.state.counter++;
    this.state.loading = true;
    this.state.value = value || this.state.value;
    this.update.next(this.state);
  }

  exitLoad() {
    this.state.counter--;
    if (this.state.counter <= 0) {
      this.state.loading = false;
      this.state.value = null;
    }
    this.update.next(this.state);
  }

  async loading<T>(action: () => Promise<T>, value?: any) {
    try {
      this.enterLoad(value);
      return await action();
    } finally {
      this.exitLoad();
    }
  }
}

export class LoaderState {
  loading: boolean;
  counter: number;
  value?: any;
}
