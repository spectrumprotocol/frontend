import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CONFIG } from '../../../consts/config';
import { ConfigInfo as GovConfigInfo } from '../../../services/api/gov/config_info';
import { PollInfo as GovPollInfo } from '../../../services/api/gov/polls_response';
import { TerrajsService } from '../../../services/terrajs.service';

type ConfigInfo = GovConfigInfo;
type PollInfo = GovPollInfo;

@Component({
  selector: 'app-poll-item',
  templateUrl: './poll-item.component.html',
  styleUrls: ['./poll-item.component.scss']
})
export class PollItemComponent implements OnChanges {

  @Input()
  poll: PollInfo;

  @Input()
  config: ConfigInfo;

  @Input()
  staked: number;

  @Input()
  link: string;

  @Input()
  unit = 'SPEC';

  votes_ratio = 0;
  yes_ratio = 0;
  no_ratio = 0;
  votes_balance = 0;
  yes_balance = 0;
  no_balance = 0;
  date: Date;
  dateLabel: string;
  quorumPositioning: number;
  constructor(
    private terrajs: TerrajsService
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    const poll: PollInfo = changes['poll']?.currentValue || this.poll;
    const config: ConfigInfo = changes['config']?.currentValue || this.config;
    const staked: number = poll?.total_balance_at_end_poll || changes['staked']?.currentValue || this.staked;
    if (poll && staked && config) {
      this.calcPoll(poll, staked, config);
    }
    this.quorumPositioning = Number(config.quorum) / 2 * 100;
  }

  private calcPoll(poll: PollInfo, staked: number, config: ConfigInfo) {
    if (poll && staked && config) {
      this.yes_ratio = +poll.yes_votes / staked;
      this.no_ratio = +poll.no_votes / staked;
      this.votes_ratio = this.yes_ratio + this.no_ratio;
      this.yes_balance = +poll.yes_votes / (this.unit ? CONFIG.UNIT : 1);
      this.no_balance = +poll.no_votes / (this.unit ? CONFIG.UNIT : 1);
      this.votes_balance = this.yes_balance + this.no_balance;
      switch (poll.status) {
        case 'in_progress':
          this.date = this.terrajs.toDate(poll.end_height);
          this.dateLabel = 'Poll end';
          break;
        case 'rejected':
          this.date = this.terrajs.toDate(poll.end_height);
          this.dateLabel = 'Ended';
          break;
        case 'passed':
          if (this.poll.execute_msgs?.length > 0) {
            this.date = this.terrajs.toDate(poll.end_height + config.effective_delay);
            this.dateLabel = 'Execution time';
          } else {
            this.date = this.terrajs.toDate(poll.end_height);
            this.dateLabel = 'Ended';
          }
          break;
        case 'executed':
          this.date = this.terrajs.toDate(poll.end_height + config.effective_delay);
          this.dateLabel = 'Executed';
          break;
        case 'expired':
          this.date = this.terrajs.toDate(poll.end_height + config.expiration_period);
          this.dateLabel = 'Expired';
          break;
      }
    }
  }
}
