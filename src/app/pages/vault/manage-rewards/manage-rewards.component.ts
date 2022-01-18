import { KeyValue } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { MdbModalRef } from 'mdb-angular-ui-kit/modal';
import { plus } from '../../../libs/math';
import { InfoService, Portfolio } from '../../../services/info.service';
import { TerrajsService } from '../../../services/terrajs.service';
import { GovService } from '../../../services/api/gov.service';
import { GoogleAnalyticsService } from 'ngx-google-analytics';

type MapToKeyValue<T> = T extends Map<infer X, infer Y> ? KeyValue<X, Y> : never;

@Component({
  selector: 'app-manage-rewards',
  templateUrl: './manage-rewards.component.html',
  styleUrls: ['./manage-rewards.component.scss'],
})
export class ManageRewardsComponent implements OnInit {
  constructor(
    public modalRef: MdbModalRef<ManageRewardsComponent>,
    public info: InfoService,
    private terrajs: TerrajsService,
    private gov: GovService,
    protected $gaService: GoogleAnalyticsService,
  ) { }

  availablePoolDays: number[] = [];

  ngOnInit() {
    this.gov.state().then(state => {
      this.availablePoolDays = state.pools
        // .filter(pool => pool.weight > 0)
        .map(pool => pool.days);
    });
  }

  getGovFarmInfo(rewardTokenContract: string) {
    return this.info.farmInfos.find(x => x.rewardTokenContract === rewardTokenContract);
  }

  async moveToGov(rewardTokenContract: string, days?: number) {
    const isSpec = rewardTokenContract === this.terrajs.settings.specToken;
    const isAstro = rewardTokenContract === this.terrajs.settings.astroToken;
    const govFarmInfo = this.getGovFarmInfo(rewardTokenContract);
    if (!govFarmInfo.autoStake) {
      return;
    }
    const withdrawAmounts: { [farmContract: string]: { amount: string, dex: string } } = {};

    if (!isAstro) {
      for (const rewardInfo of Object.values(this.info.rewardInfos)) {
        const farmInfo = this.info.farmInfos.find(x => x.farmContract === rewardInfo.farmContract);
        if (farmInfo.rewardTokenContract !== rewardTokenContract && (!isSpec || !isAstro)) {
          continue;
        }
        let pendingReward = 0;
        if (isSpec) {
          pendingReward = +rewardInfo.pending_spec_reward;
        } else if (farmInfo.dex === 'Terraswap') {
          pendingReward = +rewardInfo.pending_farm_reward;
        } else if (farmInfo.dex === 'Astroport') {
          pendingReward = +rewardInfo.pending_farm2_reward;
        }
        if (+pendingReward > 0) {
          withdrawAmounts[farmInfo.farmContract] = { amount: plus(pendingReward, withdrawAmounts[farmInfo.farmContract]?.amount ?? 0), dex: farmInfo.dex };
        }
      }
    } else {
      const farmContractsAstroportDex: Set<string> = new Set(this.info.farmInfos.filter(x => x.dex === 'Astroport').map(x => x.farmContract));
      const rewardInfosAstroportDex = Object.values(this.info.rewardInfos).filter(x => farmContractsAstroportDex.has(x.farmContract));
      for (const rewardInfo of rewardInfosAstroportDex) {
        const pendingReward = +rewardInfo.pending_farm_reward;
        if (+pendingReward > 0) {
          withdrawAmounts[rewardInfo.farmContract] = { amount: plus(pendingReward, withdrawAmounts[rewardInfo.farmContract]?.amount ?? 0), dex: 'Astroport' };
        }
      }
    }

    const totalAmounts = Object.values(withdrawAmounts).reduce((sum, data) => plus(sum, data.amount), '0');

    const mintMsg = new MsgExecuteContract(this.terrajs.address, this.terrajs.settings.gov, { mint: {} });
    const stakeGovMsg = govFarmInfo.getStakeGovMsg(totalAmounts, isSpec ? { days } : undefined);
    const withdrawMsgs = Object.keys(withdrawAmounts).map(farmContract => {
      if (withdrawAmounts[farmContract].dex === 'Astroport' && isAstro) {
        return new MsgExecuteContract(this.terrajs.address, farmContract, {
          withdraw: {
            farm_amount: withdrawAmounts[farmContract].amount,
            farm2_amount: '0',
            spec_amount: '0',
          },
        });
      } else if (withdrawAmounts[farmContract].dex === 'Astroport' && !isAstro) {
        return new MsgExecuteContract(this.terrajs.address, farmContract, {
          withdraw: {
            farm_amount: '0',
            farm2_amount: withdrawAmounts[farmContract].amount,
            spec_amount: '0',
          },
        });
      } else if (withdrawAmounts[farmContract].dex === 'Astroport' && isSpec) {
        return new MsgExecuteContract(this.terrajs.address, farmContract, {
          withdraw: {
            farm_amount: '0',
            farm2_amount: '0',
            spec_amount: withdrawAmounts[farmContract].amount,
          },
        });
      } else {
        // case Terraswap
        return new MsgExecuteContract(this.terrajs.address, farmContract, {
          withdraw: {
            farm_amount: isSpec ? '0' : withdrawAmounts[farmContract].amount,
            spec_amount: isSpec ? withdrawAmounts[farmContract].amount : '0',
          },
        });
      }
    }

    );
    await this.terrajs.post([mintMsg, ...withdrawMsgs, stakeGovMsg]);
  }

  trackTokensMap = (_: number, value: MapToKeyValue<Portfolio['tokens']>) => {
    return value.key;
  }

  getUnstakeAllMsg(): MsgExecuteContract[] {
    const rewardInfosKeys = Object.keys(this.info.rewardInfos);
    const rewardInfosKeysThatHavePendingRewards: string[] = [];
    for (const key of rewardInfosKeys) {
      if (+this.info.rewardInfos[key].pending_farm_reward > 0 || +this.info.rewardInfos[key].pending_farm2_reward > 0 || +this.info.rewardInfos[key].pending_spec_reward > 0) {
        rewardInfosKeysThatHavePendingRewards.push(key);
      }
    }
    const farmNameListThatHavePendingRewards: Set<string> = new Set();
    for (const key of rewardInfosKeysThatHavePendingRewards) {
      farmNameListThatHavePendingRewards.add(this.info.poolInfos[key].farmContract);
    }
    const msgExecuteContractList: MsgExecuteContract[] = [];
    for (const farmContract of farmNameListThatHavePendingRewards) {
      const findFarm = this.info.farmInfos.find(f => f.farmContract === farmContract);
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

  async unstakeAll() {
    this.$gaService.event('CLICK_UNSTAKE_ALL_REWARDS');
    if (!this.info.portfolio?.total_reward_ust) {
      return;
    }
    await this.terrajs.post(this.getUnstakeAllMsg());
  }

}
