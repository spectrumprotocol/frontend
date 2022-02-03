import { Component, OnDestroy, OnInit } from '@angular/core';
import { InfoService } from '../../../services/info.service';
import { Subscription } from 'rxjs';
import { TerrajsService } from '../../../services/terrajs.service';
import {FarmInfoService} from '../../../services/farm_info/farm-info.service';
import {MdbModalRef} from 'mdb-angular-ui-kit/modal';
import {Color} from '@swimlane/ngx-charts';

interface ChartData {
  name: string;
  value: number;
}


const specStakedInGov = 'SPEC staked in Gov';

const totalStakedInVaults = 'Total staked in vaults';

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
  } as Color;

  farmInfoList: FarmInfoService[];
  farmInfoName: string[];

  private connected: Subscription;
  private heightChanged: Subscription;

  constructor(
    public info: InfoService,
    private terrajs: TerrajsService,
    private modalRef: MdbModalRef<YourTvlComponent>
  ) { }

  // because totalValueItems input is delayed
  ngOnInit(): void {
    this.farmInfoList = [...new Map(this.info.farmInfos.filter(fi => this.info.shouldEnableFarmInfo(fi)).map(farmInfo => [farmInfo.farm, farmInfo])).values()];
    this.farmInfoName = this.farmInfoList.map(farmInfo => farmInfo.farm);
    this.chartColors.domain = [...this.farmInfoList.map(farmInfo => farmInfo.farmColor), '#ED7B84', '#f5dbcb', '#D6D5B3', '#7EB77F'];
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
    for (const farmInfo of this.farmInfoList) {
      chartDataListTemp.push({
        name: farmInfo.farm + ' farm',
        value: this.info.portfolio?.farms?.get(farmInfo.farm)?.bond_amount_ust || 0,
      });
    }

    chartDataListTemp.push({ name: specStakedInGov, value: this.info.portfolio?.gov.pending_reward_ust });
    chartDataListTemp.push({ name: totalStakedInVaults, value: this.info.portfolio?.total_reward_ust });
    this.chartDataList = chartDataListTemp;
  }

  closeModal() {
    this.modalRef.close();
  }

  trackChartData(_: unknown, chartData: ChartData) {
    return chartData.name;
  }
}
