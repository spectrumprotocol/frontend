import { AfterViewInit, Component } from '@angular/core';
import { fade } from '../../consts/animations';
import { LegendPosition, ViewDimensions } from '@swimlane/ngx-charts';
import { HttpClient } from '@angular/common/http';
import { CONFIG } from 'src/app/consts/config';
import { DecimalPipe } from '@angular/common';

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
  displayData: any;
  tvlData: IChartData[];
  specCirculationData: ISerial[];
  graphData: IChartData[];
  UNIT = CONFIG.UNIT;
  view: any = [undefined, 40];
  viewDonut: any = [700, 300];
  viewArea: any = undefined;
  showLegend: boolean = true;
  legendPosition = LegendPosition.Below;
  legendArea: boolean = true;
  xAxisArea: boolean = false;
  yAxisArea: boolean = false;
  timelineArea: boolean = true;
  gradient: boolean = true;

  colorScheme = {
    domain: ['#fc5185', '#ff8dc1', '#d4295d']
  } as any;;

  customColors = {
    domain: ['#5AA454', '#E44D25']
  } as any;

  colorAreaChart = {
    domain: ['#181d23']
  } as any;

  constructor(private http: HttpClient,
              private num: DecimalPipe) {
    this.view = [innerWidth / 1.35, 40];
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
        this.tvlData = [{
          name: 'tvl',
          series: [{
            name: 'gov',
            value: Math.round(result.tvl.gov)
          }, {
            name: 'lpVaults',
            value: Math.round(result.tvl.lpVaults)
          }]
        }];
        
        this.specCirculationData = [{
          name: 'gov',
          value: result.circulation.gov
        }, {
          name: 'lpVaults',
          value: result.circulation.lpVaults
        }, {
          name: 'others',
          value: result.circulation.others
        } ,{
          name: 'total',
          value: result.circulation.total
        }]

        this.graphData = [{
          name: 'test',
          series: result.tvl.previousValues.map(it => {
            return {
              name: it.date,
              value: it.total
            };
            })
        }];
      });
  }

  onResize(event) {
    this.view = [event.target.innerWidth / 1.30, 40];
  }
}
