import { AfterViewInit, Component } from '@angular/core';
import { fade } from '../../consts/animations';
import { LegendPosition, ViewDimensions } from '@swimlane/ngx-charts';
import { HttpClient } from '@angular/common/http';
import { CONFIG } from 'src/app/consts/config';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ShortNumPipe } from '../../pipes/short-num.pipe';
import {TerrajsService} from '../../services/terrajs.service';

export interface IChartData {
  name: string;
  series: ISerial[];
}

export interface ISerial {
  name: string;
  value: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  animations: [fade]
})
export class DashboardComponent implements AfterViewInit {
  displayData: any = null;
  tvlData;
  specCirculationData: ISerial[];
  graphData: IChartData[];
  legendData;
  UNIT = CONFIG.UNIT;
  viewDonut: any = [700, 300];
  viewArea: any = undefined;
  legendArea = true;
  xAxisArea = false;
  yAxisArea = false;
  timelineArea = true;
  gradient = true;

  colorScheme = {
    domain: ['#ff8dc1', '#fc5185', '#d4295d']
  } as any;

  colorAreaChart = {
    domain: ['#555965']
  } as any;

  constructor(private http: HttpClient,
              private shortNumPipe: ShortNumPipe,
              private terrajs: TerrajsService) {
    this.viewDonut = [innerWidth / 1.35, 400];
    this.viewArea = undefined;
  }

  ngAfterViewInit() {
    this.initializeDashboardData();
  }

  initializeDashboardData() {
      this.http.get<any>(this.terrajs.settings.specAPI + '/data?type=dashboard').subscribe(result => {
        this.displayData = result;
        this.tvlData = {
          gov: {
            name: 'gov',
            shortValue: this.shortNumPipe.transform(Math.round(result.tvl.gov) / this.UNIT),
            value: Math.round(result.tvl.gov),
            percentage: result.tvl.gov / result.tvl.total * 100
          },
          lpVaults: {
            name: 'lpVaults',
            shortValue: this.shortNumPipe.transform(Math.round(result.tvl.lpVaults) / this.UNIT),
            value: Math.round(result.tvl.lpVaults),
            percentage: result.tvl.lpVaults / result.tvl.total * 100
          }
        };
        this.specCirculationData = [{
          name: 'Staked',
          value: result.circulation.gov / this.UNIT
        }, {
          name: 'LP',
          value: result.circulation.lpVaults / this.UNIT
        }, {
          name: 'Others',
          value: result.circulation.others / this.UNIT
        }];

        this.graphData = [{
          name: '',
          series: result.tvl.previousValues.reverse().map(it => {
            return {
              name: it.date,
              value: it.total
            };
            })
        }];
      });
  }

  formatDataLabel(data) {
    return `${data.data.name}: ${data.value.toLocaleString()} SPEC`;
  }

}
