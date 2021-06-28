import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CONFIG } from '../../consts/config';
import { GovService } from '../../services/api/gov.service';
import { ConfigInfo } from '../../services/api/gov/config_info';
import { PollInfo, PollStatus } from '../../services/api/gov/polls_response';
import { TokenService } from '../../services/api/token.service';
import { InfoService } from '../../services/info.service';
import { TerrajsService } from '../../services/terrajs.service';

const LIMIT = 10;

@Component({
  selector: 'app-gov',
  templateUrl: './gov.component.html',
  styleUrls: ['./gov.component.scss']
})
export class GovComponent implements OnInit, OnDestroy {

  polls: PollInfo[] = [];
  hasMore = false;
  config: ConfigInfo;
  supply = 0;
  myStaked = 0;
  filteredStatus = '' as PollStatus;
  UNIT = CONFIG.UNIT;
  private connected: Subscription;

  constructor(
    private gov: GovService,
    public info: InfoService,
    private terrajs: TerrajsService,
    private token: TokenService,
  ) { }

  ngOnInit() {
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        this.token.query(this.terrajs.settings.specToken, { token_info: {} })
          .then(it => this.supply = +it.total_supply);
        this.gov.config()
          .then(it => this.config = it);
        this.info.refreshStat();

        this.pollReset();
        if (connected) {
          this.gov.balance()
            .then(it => this.myStaked = +it.balance);
        }
      });
  }

  ngOnDestroy() {
    this.connected.unsubscribe();
  }

  async pollReset() {
    const res = await this.gov.query({
      polls: {
        filter: this.filteredStatus || undefined,
        limit: LIMIT
      }
    });
    this.polls = res.polls;
    this.hasMore = res.polls.length >= LIMIT;
  }

  async pollMore() {
    const res = await this.gov.query({
      polls: {
        filter: this.filteredStatus || undefined,
        limit: LIMIT,
        start_after: this.polls[this.polls.length - 1].id,
      }
    });
    this.polls.push(...res.polls);
    this.hasMore = res.polls.length >= LIMIT;
  }
}
