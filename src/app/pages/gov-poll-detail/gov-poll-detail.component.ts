import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { Subscription } from 'rxjs';
import { fade } from '../../consts/animations';
import { CONFIG } from '../../consts/config';
import { times } from '../../libs/math';
import { GovService } from '../../services/api/gov.service';
import { ConfigInfo } from '../../services/api/gov/config_info';
import { PollInfo } from '../../services/api/gov/polls_response';
import { TerrajsService } from '../../services/terrajs.service';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { environment } from 'src/environments/environment';
import { fromBase64 } from 'src/app/libs/base64';

@Component({
  selector: 'app-gov-poll-detail',
  templateUrl: './gov-poll-detail.component.html',
  styleUrls: ['./gov-poll-detail.component.scss'],
  animations: [fade]
})
export class GovPollDetailComponent implements OnInit, OnDestroy {

  poll: PollInfo;
  config: ConfigInfo;
  staked: number;

  canVote = false;
  canEnd = false;
  canExecute = false;
  canExpire = false;
  production = environment.production;

  amount: number;
  maxAmount = 0;

  yourVote: number;
  voteOption: 'yes' | 'no';

  @ViewChild('form') form: NgForm;

  private connected: Subscription;

  constructor(
    private gov: GovService,
    private route: ActivatedRoute,
    private router: Router,
    public terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
  ) { }

  async ngOnInit() {
    const poll_id = +this.route.snapshot.paramMap.get('id');
    this.$gaService.event('VIEW_GOV_POLL', poll_id.toString());
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        const stateTask = this.gov.query({ state: {} })
          .then(it => this.staked = +it.total_staked);
        const configTask = this.gov.config()
          .then(it => this.config = it);
        const pollTask = this.gov.query({ poll: { poll_id } });
        const height = await this.terrajs.getHeight();
        Promise.all([stateTask, configTask, pollTask])
          .then(([state, config, poll]) => this.resetPoll(poll, connected, height));
      });
  }

  private resetPoll(poll: PollInfo, connected: boolean, height: number) {
    this.poll = poll;
    this.canVote = false;
    this.canEnd = false;
    this.canExecute = false;
    this.canExpire = false;
    if (poll.status === 'in_progress') {
      this.canVote = height <= poll.end_height;
      const threshold = +times(this.config.threshold, this.staked);
      this.canEnd = !this.canVote || +poll.yes_votes >= threshold || +poll.no_votes >= threshold;
    } else if (poll.status === 'passed' && poll.execute_msgs?.length &&
      height > (poll.end_height + this.config.effective_delay)) {
      this.canExecute = true;
      this.canExpire = height > (poll.end_height + this.config.expiration_period);
    }
    if (this.canVote && connected) {
      this.gov.balance()
        .then(balance => {
          const voted = balance.locked_balance.find(it => it[0] === poll.id);
          if (voted) {
            this.yourVote = +voted[1].balance;
            this.voteOption = voted[1].vote;
            this.canVote = false;
          }
          this.maxAmount = +balance.balance / CONFIG.UNIT;
        });
    }
  }

  ngOnDestroy(): void {
    this.connected.unsubscribe();
  }
  setMax() {
    this.amount = this.maxAmount;
  }

  async vote(vote: 'yes' | 'no') {
    if (this.form.invalid) {
      return;
    }

    const poll_id = this.poll.id;
    const amount = times(this.amount, CONFIG.UNIT);
    await this.gov.handle({
      poll_vote: {
        amount,
        poll_id,
        vote
      }
    });
    this.$gaService.event('VOTE_GOV_POLL', poll_id.toString(), vote);
    this.router.navigateByUrl('/gov');
  }

  async submit(action: string) {
    const poll_id = this.poll.id;
    if (action === 'End poll') {
      await this.terrajs.post([
        new MsgExecuteContract(
          this.terrajs.address,
          this.terrajs.settings.gov,
          {
            mint: {}
          }
        ),
        new MsgExecuteContract(
          this.terrajs.address,
          this.terrajs.settings.gov,
          {
            poll_end: { poll_id }
          },
        )
      ]);
    } else if (action === 'Execute poll') {
      await this.terrajs.post([
        new MsgExecuteContract(
          this.terrajs.address,
          this.terrajs.settings.gov,
          {
            mint: {}
          }
        ),
        new MsgExecuteContract(
          this.terrajs.address,
          this.terrajs.settings.gov,
          {
            poll_execute: { poll_id }
          },
        )
      ]);
    } else if (action === 'Expire poll') {
      await this.terrajs.post([
        new MsgExecuteContract(
          this.terrajs.address,
          this.terrajs.settings.gov,
          {
            mint: {}
          }
        ),
        new MsgExecuteContract(
          this.terrajs.address,
          this.terrajs.settings.gov,
          {
            poll_expire: { poll_id }
          },
        )
      ]);
    }

    this.router.navigateByUrl('/gov');
  }

  async simulate() {
    const msgs: MsgExecuteContract[] = [];
    msgs.push(new MsgExecuteContract(
      this.terrajs.settings.gov,
      this.terrajs.settings.gov,
      { mint: {} })
    );
    for (const msg of this.poll.execute_msgs) {
      msgs.push(new MsgExecuteContract(
        this.terrajs.settings.gov,
        msg.execute.contract,
        JSON.parse(msg.execute.msg)
      ));
    }
    try {
      await this.terrajs.lcdClient.tx.create(
        this.terrajs.settings.gov,
        {
          msgs,
          feeDenoms: ['uusd']
        }
      );
      console.log('success');
    } catch (e) {
      console.error(e.response?.data?.error || e.message);
    }
  }
}
