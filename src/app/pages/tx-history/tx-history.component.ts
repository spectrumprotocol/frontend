import {Component, OnDestroy, OnInit} from '@angular/core';
import {TerrajsService} from '../../services/terrajs.service';
import {Subscription} from 'rxjs/dist/types';
import {CONFIG} from '../../consts/config';
import {InfoService} from '../../services/info.service';
import {CalcService} from '../../services/calc.service';
import {GoogleAnalyticsService} from 'ngx-google-analytics';

@Component({
  selector: 'app-tx-history',
  templateUrl: './tx-history.component.html',
  styleUrls: ['./tx-history.component.scss']
})
export class TxHistoryComponent implements OnInit, OnDestroy {

  private connected: Subscription;
  loading = true;

  constructor(
    public info: InfoService,
    public terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
  ) { }

  async ngOnInit() {
    this.$gaService.event('OPEN_TX_HISTORY_PAGE');
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        if (connected){
          this.loading = true;
          if (this.info.txHistoryList.length === 0){
            await this.info.ensureCoinInfos();
            await this.info.updateFarmInfoContractAddress();
            await this.info.populateTxHistory();
          }
          this.loading = false;
        }
      });
  }

  ngOnDestroy() {
    this.connected.unsubscribe();
  }

  async loadMore(){
    if (this.loading){
      return;
    }
    this.loading = true;
    await this.info.populateTxHistory();
    this.loading = false;
  }

}
