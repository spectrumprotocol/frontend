import { Component, OnDestroy, OnInit } from '@angular/core';
import { InfoService } from '../../../services/info.service';
import { Subscription } from 'rxjs';
import { TerrajsService } from '../../../services/terrajs.service';
import { MdbModalRef } from 'mdb-angular-ui-kit';

interface ChartData {
  name: string;
  value: number;
}

@Component({
  selector: 'app-your-tvl',
  templateUrl: './your-tvl.component.html',
  styleUrls: ['./your-tvl.component.scss']
})
export class YourTvlComponent implements OnInit, OnDestroy {

  loading = false;
  chartDataList: ChartData[];

  chartColors = {
    domain: []
  };
  puiArray = [{
    farm: 'Spectrum',
    val: '10'
  }, {
    farm: 'Mirror',
    val: '20'
  }];
  private connected: Subscription;
  private heightChanged: Subscription;

  constructor(
    public info: InfoService,
    private terrajs: TerrajsService,
    private modalRef: MdbModalRef<YourTvlComponent>
  ) { }

  // because totalValueItems input is delayed
  ngOnInit(): void {
    this.chartColors.domain = [...this.info.farmInfos.map(farmInfo => farmInfo.farmColor), '#ED7B84', '#f5dbcb', '#D6D5B3', '#7EB77F'];
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        if (connected && !this.chartDataList) {
          this.refreshChartDataList();
        }
      });
    this.heightChanged = this.terrajs.heightChanged.subscribe(async _ => {
      // if (this.terrajs.isConnected) {
        this.refreshChartDataList();
      // }
    });
  }

  ngOnDestroy() {
    this.connected.unsubscribe();
    this.heightChanged.unsubscribe();
  }

  refreshChartDataList() {
    if (!this.info.portfolio) {
      return;
    }
    const chartDataListTemp: ChartData[] = [];
    for (const farmInfo of this.info.farmInfos) {
      chartDataListTemp.push({
        name: farmInfo.farm,
        value: this.info.portfolio?.farms.get(farmInfo.farm).bond_amount_ust,
      });
    }

    chartDataListTemp.push({ name: 'SPEC staked in Gov', value: this.info.portfolio?.gov.pending_reward_ust });
    chartDataListTemp.push({ name: 'Total staked in vaults', value: this.info.portfolio?.total_reward_ust });
    // this.chartDataList = chartDataListTemp;
    this.chartDataList = [{
        name: 'pui',
        value: 20,
      }, {
        name: 'anna',
        value: 30,
      }, {
        name: 'pao',
        value: 50,
      }
    ]
    this.chartDataList.push({ name: 'SPEC staked in Gov', value: 11 });
    this.chartDataList.push({ name: 'Total staked in vaults', value: 12});
  }

  closeModal() {
    this.modalRef.close();
  }
}
