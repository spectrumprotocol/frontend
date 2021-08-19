import { Component, OnInit } from '@angular/core';
import { InfoService } from '../../../services/info.service';
import { TerrajsService } from '../../../services/terrajs.service';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { KeyValue } from '@angular/common';

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

  async unstakeAll() {
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
      const findFarm = this.info.farmInfos.find(f => f.farmName === farmName);
      msgExecuteContractList.push(new MsgExecuteContract(
        this.terrajs.address,
        findFarm.farmContract,
        {
          withdraw: {}
        }
      ));
    }
    this.$gaService.event('CLICK_UNSTAKE_ALL_REWARDS');
    const mintMsg = new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.gov,
      {
        mint: {}
      }
    );
    await this.terrajs.post([mintMsg, ...msgExecuteContractList]);
  }

  asIsOrder() {
    return 1;
  }

  key(item: any) {
    return item.key;
  }
}
