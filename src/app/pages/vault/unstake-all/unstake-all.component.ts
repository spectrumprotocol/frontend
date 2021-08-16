import { Component, OnInit } from '@angular/core';
import {InfoService} from '../../../services/info.service';
import {MdbModalRef} from 'mdb-angular-ui-kit';
import {TerrajsService} from '../../../services/terrajs.service';
import {MsgExecuteContract} from '@terra-money/terra.js';
import {UnstakeMsgService} from '../../../services/unstake_msg.service';
import {GoogleAnalyticsService} from 'ngx-google-analytics';

@Component({
  selector: 'app-unstake-all',
  templateUrl: './unstake-all.component.html',
  styleUrls: ['./unstake-all.component.scss']
})
export class UnstakeAllComponent implements OnInit {

  pendingRewardByFarmTokenKeys: string[] = [];
  constructor(
    public info: InfoService,
    private terrajs: TerrajsService,
    private unstakeMsgService: UnstakeMsgService,
    protected $gaService: GoogleAnalyticsService,
  ) { }

  ngOnInit(): void {
    this.initPendingRewardByFarmTokenKeys();
  }

  initPendingRewardByFarmTokenKeys(){
    const keys = Object.keys(this.info.pendingRewardByFarmToken);
    keys.splice(keys.indexOf('GOV_SPEC'), 1);
    this.pendingRewardByFarmTokenKeys = keys;
  }

  getPendingStakedRewardTotalAmount(){
    let sum = 0;
    this.pendingRewardByFarmTokenKeys.forEach(key => {
      sum += this.info.pendingRewardByFarmToken[key].pending_reward_ust;
    });
    return sum;
  }

  async unstakeAll() {
    const rewardInfosKeys = Object.keys(this.info.rewardInfos);
    const rewardInfosKeysThatHavePendingRewards: string[] = [];
    rewardInfosKeys.forEach(key => {
      if (+this.info.rewardInfos[key].pending_farm_reward > 0 || +this.info.rewardInfos[key].pending_spec_reward > 0){
        rewardInfosKeysThatHavePendingRewards.push(key);
      }
    });
    const farmNameListThatHavePendingRewards: Set<string> = new Set();
    rewardInfosKeysThatHavePendingRewards.forEach(key => {
      farmNameListThatHavePendingRewards.add(this.info.poolInfos[key].farm);
    });
    const msgExecuteContractList: MsgExecuteContract[] = [];
    farmNameListThatHavePendingRewards.forEach(farmName => {
      msgExecuteContractList.push(this.unstakeMsgService.generateWithdrawMsg(farmName, true));
    });
    this.$gaService.event('CLICK_UNSTAKE_ALL_REWARDS');
    await this.terrajs.post([this.unstakeMsgService.generateMintMsg(), ...msgExecuteContractList]);
  }
}
