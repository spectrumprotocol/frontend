import { KeyValue } from '@angular/common';
import { Component } from '@angular/core';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { MdbModalRef } from 'mdb-angular-ui-kit';
import { plus } from 'src/app/libs/math';
import { InfoService, Portfolio } from 'src/app/services/info.service';
import { TerrajsService } from 'src/app/services/terrajs.service';

type MapToKeyValue<T> = T extends Map<infer X, infer Y> ? KeyValue<X, Y> : never;

@Component({
  selector: 'app-manage-rewards',
  templateUrl: './manage-rewards.component.html',
})
export class ManageRewardsComponent {
  constructor(
    public modalRef: MdbModalRef<ManageRewardsComponent>,
    public info: InfoService,
    private terrajs: TerrajsService
  ) { }

  async moveToGov(tokenSymbol: string, days?: number) {
    const isSpec = tokenSymbol === 'SPEC';
    const govFarmInfo = this.info.farmInfos.find(x => x.tokenSymbol === tokenSymbol);
    const withdrawAmounts: { [farmContract: string]: string } = {};

    for (const rewardInfo of Object.values(this.info.rewardInfos)) {
      const farmInfo = this.info.farmInfos.find(x => x.farm === rewardInfo.farm);

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
