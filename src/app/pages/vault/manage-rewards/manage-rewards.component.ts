import { KeyValue } from '@angular/common';
import {Component, OnInit} from '@angular/core';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { MdbModalRef } from 'mdb-angular-ui-kit';
import { plus } from '../../../libs/math';
import { InfoService, Portfolio } from '../../../services/info.service';
import { TerrajsService } from '../../../services/terrajs.service';
import {GovService} from '../../../services/api/gov.service';

type MapToKeyValue<T> = T extends Map<infer X, infer Y> ? KeyValue<X, Y> : never;

@Component({
  selector: 'app-manage-rewards',
  templateUrl: './manage-rewards.component.html',
})
export class ManageRewardsComponent implements OnInit{
  constructor(
    public modalRef: MdbModalRef<ManageRewardsComponent>,
    public info: InfoService,
    private terrajs: TerrajsService,
    private gov: GovService
  ) { }

  availablePoolDays: number[] = [];

  ngOnInit() {
    this.gov.state().then(state => {
      this.availablePoolDays = state.pools.filter(pool => pool.active).map(pool => pool.days);
    });
  }

  getGovFarmInfo(tokenSymbol: string){
    return this.info.farmInfos.find(x => x.tokenSymbol === tokenSymbol);
  }

  async moveToGov(tokenSymbol: string, days?: number) {
    const isSpec = tokenSymbol === 'SPEC';
    const govFarmInfo = this.getGovFarmInfo(tokenSymbol);
    if (!govFarmInfo.autoStake){
      return;
    }
    const withdrawAmounts: { [farmContract: string]: string } = {};

    for (const rewardInfo of Object.values(this.info.rewardInfos)) {
      const farmInfo = this.info.farmInfos.find(x => x.farmContract === rewardInfo.farmContract);
      if (farmInfo.tokenSymbol !== tokenSymbol && !isSpec) {
        continue;
      }

      const pendingReward = isSpec ? rewardInfo.pending_spec_reward : rewardInfo.pending_farm_reward as string;
      withdrawAmounts[farmInfo.farmContract] = plus(pendingReward, withdrawAmounts[farmInfo.farmContract] ?? 0);
    }

    const totalAmounts = Object.values(withdrawAmounts).reduce((sum, amount) => plus(sum, amount), '0');

    const mintMsg = new MsgExecuteContract(this.terrajs.address, this.terrajs.settings.gov, { mint: {} });
    const stakeGovMsg = govFarmInfo.getStakeGovMsg(totalAmounts, isSpec ? { days } : undefined);
    const withdrawMsgs = Object.keys(withdrawAmounts).map(farmContract =>
      new MsgExecuteContract(this.terrajs.address, farmContract, {
        withdraw: {
          farm_amount: isSpec ? '0' : withdrawAmounts[farmContract],
          spec_amount: isSpec ? withdrawAmounts[farmContract] : '0',
        },
      })
    );
    await this.terrajs.post([mintMsg, ...withdrawMsgs, stakeGovMsg]);
  }

  trackTokensMap = (_: number, value: MapToKeyValue<Portfolio['tokens']>) => {
    return value.key;
  }
}
