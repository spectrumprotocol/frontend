import {AfterContentInit, AfterViewInit, Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ChartData, InfoService} from '../../../services/info.service';
import {Subscription} from 'rxjs/dist/types';
import {TerrajsService} from '../../../services/terrajs.service';
import {MdbModalRef} from 'mdb-angular-ui-kit';

export interface TotalValueItem {
  title: string;
  valueRef: string;
}

@Component({
  selector: 'app-your-tvl',
  templateUrl: './your-tvl.component.html',
  styleUrls: ['./your-tvl.component.scss']
})
export class YourTvlComponent implements OnInit, OnDestroy {

  loading = false;
  totalValueItems: TotalValueItem[] = [];

  // MIRROR, SPEC, ANCHOR, PYLON, totalValueItem 0-3
  chartColors = {
    domain: ['#232C45', '#fc5185', '#3bac3b', '#00cfda', '#ED7B84', '#f5dbcb', '#D6D5B3', '#7EB77F']
  };

  private connected: Subscription;
  private heightChanged: Subscription;

  constructor(
    public info: InfoService,
    private terrajs: TerrajsService,
    private modalRef: MdbModalRef<YourTvlComponent>
  ) { }

  // because totalValueItems input is delayed
  ngOnInit(): void {
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        if (connected && !this.info.chartDataList && this.totalValueItems.length !== 0){
          this.refreshChartDataList();
        }
      });
    this.heightChanged = this.terrajs.heightChanged.subscribe(async i => {
      if (this.terrajs.isConnected && this.totalValueItems.length !== 0) {
        this.refreshChartDataList();
      }
    });
  }

  ngOnDestroy() {
    this.connected.unsubscribe();
    this.heightChanged.unsubscribe();
  }

  sumAutoStakedFarmRewardsUST(){
    const keys = Object.keys(this.info.pendingRewardByFarmToken);
    let sum = 0;
    keys.map(key => {
      sum = sum + this.info.pendingRewardByFarmToken[key].pending_reward_ust;
    });
    sum = sum - this.info.pendingRewardByFarmToken['GOV_SPEC'].pending_reward_ust;
    return sum;
  }


  getValueByReference(item: string){
    switch (item){
      case('item0'):
        return this.info.pendingRewardByFarmToken['GOV_SPEC'].pending_reward_ust;
      case('item1'):
        return this.sumAutoStakedFarmRewardsUST();
      // case('item2'):
      //   return +this.info.userSpecAmount;
      // case('item3'):
      //   return +this.info.userUstAmount;
    }
  }

  refreshChartDataList(){
    const chartDataListTemp: ChartData[] = [];
    this.info.farmInfos.forEach(farmInfo => {
      chartDataListTemp.push({
        name: farmInfo.farmName,
        value: this.info.bondAmountUstByFarm[farmInfo.tokenSymbol]
      });
    });
    this.totalValueItems.forEach(item => {
      chartDataListTemp.push({name: item.title, value: this.getValueByReference(item.valueRef)});
    });
    this.info.chartDataList = chartDataListTemp;
  }

  closeModal() {
   this.modalRef.close();
  }
}
