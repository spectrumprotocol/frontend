import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {CONFIG} from '../../consts/config';
import {GovService} from '../../services/api/gov.service';
import {ConfigInfo} from '../../services/api/gov/config_info';
import {PollInfo, PollStatus} from '../../services/api/gov/polls_response';
import {InfoService} from '../../services/info.service';
import {TerrajsService} from '../../services/terrajs.service';
import {GoogleAnalyticsService} from 'ngx-google-analytics';
import {GovPoolDetail} from './gov-pool/gov-pool.component';
import {BalanceResponse} from '../../services/api/gov/balance_response';
import {StateInfo} from '../../services/api/gov/state_info';

const LIMIT = 10;

@Component({
  selector: 'app-gov',
  templateUrl: './gov.component.html',
  styleUrls: ['./gov.component.scss']
})
export class GovComponent implements OnInit, OnDestroy {
  poolDetails: GovPoolDetail[] = [];
  polls: PollInfo[] = [];
  hasMore = false;
  config: ConfigInfo;
  myPendingReward = 0;
  stakedInGovAPR = 0;
  filteredStatus = '' as PollStatus;
  stateInfo: StateInfo;
  myBalance: BalanceResponse;
  UNIT = CONFIG.UNIT;
  private connected: Subscription;
  private onTransaction: Subscription;

  constructor(
    private gov: GovService,
    public info: InfoService,
    public terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService
  ) {
  }

  ngOnInit() {
    this.$gaService.event('VIEW_GOV_PAGE');
    this.onTransaction = this.terrajs.transactionComplete.subscribe(() => {
      this.info.refreshBalance({native_token: true, spec: true});
    });
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        if (connected) {
          await this.info.refreshBalance({native_token: true, spec: true});
        }
        this.info.initializeVaultData(connected);
        this.gov.config()
          .then(it => this.config = it);
        this.pollReset();
      });
  }

  ngOnDestroy() {
    this.connected.unsubscribe();
    this.onTransaction.unsubscribe();
  }

  async pollReset() {
    const res = await this.gov.query({
      polls: {
        filter: this.filteredStatus || undefined,
        limit: LIMIT
      }
    });

    this.polls = res.polls.filter(poll => !this.info.malicious_polls.has(poll.id) || poll.id <= 46);
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
    this.$gaService.event('VIEW_GOV_PAGE', 'LOAD_MORE_POLL');
  }

  trackPoolDetails(_: unknown, poolDetail: GovPoolDetail) {
    return poolDetail.days;
  }
}
