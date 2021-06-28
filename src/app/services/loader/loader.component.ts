import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { LoaderService } from '../loader.service';

@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss']
})
export class LoaderComponent implements OnInit, OnDestroy {
  private updateEvent: Subscription;
  loading = false;
  loadingMessage: string;

  constructor(
    private cdr: ChangeDetectorRef,
    private loaderService: LoaderService
  ) { }

  ngOnInit() {
    this.updateEvent = this.loaderService.update
      .subscribe(state => {
        this.loading = state.loading;
        this.loadingMessage = state.value;
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy() {
    this.updateEvent.unsubscribe();
  }
}
