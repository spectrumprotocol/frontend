import { Component } from '@angular/core';
import { InfoService } from '../../../services/info.service';
import { TerrajsService } from '../../../services/terrajs.service';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import {MdbModalService} from 'mdb-angular-ui-kit/modal';


@Component({
  selector: 'app-unstake-all',
  templateUrl: './unstake-all.component.html',
  styleUrls: ['./unstake-all.component.scss']
})
export class UnstakeAllComponent {

  constructor(
    public info: InfoService,
    private terrajs: TerrajsService,
    private modalService: MdbModalService,
    protected $gaService: GoogleAnalyticsService,
  ) { }

  disableManageRewards(){
    return !this.info.portfolio?.total_reward_ust;
  }

  async manageRewards() {
    if (this.disableManageRewards()) {
      return;
    }

    const modal = await import('../manage-rewards/manage-rewards.component');
    this.modalService.open(modal.ManageRewardsComponent, {
      modalClass: 'modal-manage-rewards',
    });
  }

  asIsOrder() {
    return 1;
  }

  key(item: any) {
    return item.key;
  }
}
