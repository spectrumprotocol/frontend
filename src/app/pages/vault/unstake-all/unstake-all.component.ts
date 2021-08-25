import { Component, OnInit } from '@angular/core';
import { InfoService } from '../../../services/info.service';
import { TerrajsService } from '../../../services/terrajs.service';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { KeyValue } from '@angular/common';
import {CONFIG} from '../../../consts/config';
import {floor, times} from '../../../libs/math';

@Component({
  selector: 'app-unstake-all',
  templateUrl: './unstake-all.component.html',
  styleUrls: ['./unstake-all.component.scss']
})
export class UnstakeAllComponent {

  constructor(
    public info: InfoService,
    private terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
  ) { }

  getUnstakeAllMsg(): MsgExecuteContract[] {
    const rewardInfosKeys = Object.keys(this.info.rewardInfos);
    const rewardInfosKeysThatHavePendingRewards: string[] = [];
    for (const key of rewardInfosKeys) {
      if (+this.info.rewardInfos[key].pending_farm_reward > 0 || +this.info.rewardInfos[key].pending_spec_reward > 0) {
        rewardInfosKeysThatHavePendingRewards.push(key);
      }
    }
    const farmNameListThatHavePendingRewards: Set<string> = new Set();
    for (const key of rewardInfosKeysThatHavePendingRewards) {
      farmNameListThatHavePendingRewards.add(this.info.poolInfos[key].farm);
    }
    const msgExecuteContractList: MsgExecuteContract[] = [];
    for (const farmName of farmNameListThatHavePendingRewards) {
      const findFarm = this.info.farmInfos.find(f => f.farm === farmName);
      msgExecuteContractList.push(new MsgExecuteContract(
        this.terrajs.address,
        findFarm.farmContract,
        {
          withdraw: {}
        }
      ));
    }
    const mintMsg = new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.gov,
      {
        mint: {}
      }
    );
    return [mintMsg, ...msgExecuteContractList];
  }

  async unstakeAll(){
    this.$gaService.event('CLICK_UNSTAKE_ALL_REWARDS');
    if (!this.info.portfolio?.total_reward_ust){
      return;
    }
    await this.terrajs.post(this.getUnstakeAllMsg());
  }

  async doMoveToGov(){
    this.$gaService.event('CLICK_MOVE_STAKED_REWARD_TO_GOV');
    if (!this.info.portfolio?.total_reward_ust){
      return;
    }
    let msg: MsgExecuteContract[] = this.getUnstakeAllMsg();
    for (const token of this.info.portfolio.tokens){
      const foundFarmInfo = this.info.farmInfos.find(farmInfo => farmInfo.tokenSymbol === token[0]);
      if (foundFarmInfo && token[1].pending_reward_token > 0){
        msg = [...msg, foundFarmInfo.getStakeGovMsg(floor(times(token[1].pending_reward_token, CONFIG.UNIT)))];
      }
    }
    await this.terrajs.post(msg);
  }

  asIsOrder() {
    return 1;
  }

  key(item: any) {
    return item.key;
  }
}
