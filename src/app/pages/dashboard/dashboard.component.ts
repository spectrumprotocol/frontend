import { AfterViewInit, Component } from '@angular/core';
import { fade } from '../../consts/animations';
import { LegendPosition, ViewDimensions } from '@swimlane/ngx-charts';
import { HttpClient } from '@angular/common/http';
import { CONFIG } from 'src/app/consts/config';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ShortNumPipe } from '../../pipes/short-num.pipe';

export interface IChartData {
  name: string,
  series: ISerial[]
}

export interface ISerial {
  name: string,
  value: number
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  animations: [fade]
})
export class DashboardCompoent implements AfterViewInit {
  displayData: any = null;
  tvlData;
  specCirculationData: ISerial[];
  graphData: IChartData[];
  legendData;
  UNIT = CONFIG.UNIT;
  viewDonut: any = [700, 300];
  viewArea: any = undefined;
  legendArea: boolean = true;
  xAxisArea: boolean = false;
  yAxisArea: boolean = false;
  timelineArea: boolean = true;
  gradient: boolean = true;

  colorScheme = {
    domain: ['#fc5185', '#ff8dc1', '#d4295d']
  } as any;;

  colorAreaChart = {
    domain: ['#181d23']
  } as any;

  constructor(private http: HttpClient,
              private shortNumPipe: ShortNumPipe) {
    this.viewDonut = [innerWidth / 1.35, 400];
    this.viewArea = undefined;
  }

  ngAfterViewInit() {
    this.getMockData();
  }

  getMockData() {
      let geturl = "https://specapi.azurefd.net/api/data?type=dashboard";
      this.http.get<any>(geturl).subscribe(result => {
        this.displayData = result;
        console.log(this.displayData);
        this.tvlData = {
          gov: {
            name: 'gov',
            shortValue: this.shortNumPipe.transform(Math.round(result.tvl.gov) / this.UNIT),
            value: Math.round(result.tvl.gov),
            percentage: this.relDiff(result.tvl.gov, result.tvl.lpVaults)
          },
          lpVaults: {
            name: 'lpVaults',
            shortValue: this.shortNumPipe.transform(Math.round(result.tvl.lpVaults) / this.UNIT),
            value: Math.round(result.tvl.lpVaults),
            percentage: this.relDiff(result.tvl.lpVaults, result.tvl.gov)
          }
        };
        console.log(this.tvlData);
        this.specCirculationData = [{
          name: 'Staked',
          value: result.circulation.gov
        }, {
          name: 'LP',
          value: result.circulation.lpVaults
        }, {
          name: 'others',
          value: result.circulation.others
        }]

        this.graphData = [{
          name: '',
          series: result.tvl.previousValues.map(it => {
            return {
              name: it.date,
              value: it.total
            };
            })
        }];
      });
  }

  relDiff(a, b) {
    const remainValue = Math.round(a);
    const total = remainValue + Math.round(b);
    return ((total - remainValue) / total) * 100
   }

  formatDataLabel(data) {
    return  `${data.data.name}: ${data.value.toLocaleString()} SPEC`;
  }

  displayTimeLine(data) {
    return data[0].name;
  }

  displayVal(data) {
    return this.shortNumPipe.transform(Math.round(data[0].value) / this.UNIT);
  }
}
