import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { CONFIG } from '../../../consts/config';
import { toBase64 } from '../../../libs/base64';
import { times } from '../../../libs/math';
import { GovService } from '../../../services/api/gov.service';
import { TokenService } from '../../../services/api/token.service';
import { TerrajsService } from '../../../services/terrajs.service';
import { MdbCollapseDirective } from 'mdb-angular-ui-kit/collapse';
import { Msg, MsgExecuteContract } from '@terra-money/terra.js';

export enum GovPoolTab {
  Deposit,
  Move,
  Withdraw,
}

export interface GovPoolDetail {
  days: number;
  balance: string;
  apr: number;
  userBalance: string;
  userAUst: string;
  userProfit: string;
  austApr: number;
  userAvailableBalance: string;
  unlockAt: Date | null;
  moveOptions: { days: number; userBalance: string; unlockAt: Date | null }[];
}

@Component({
  selector: 'app-gov-pool',
  templateUrl: './gov-pool.component.html',
  styleUrls: ['./gov-pool.component.scss'],
})
export class GovPoolComponent implements OnChanges {
  @Input() detail: GovPoolDetail;
  @Input() walletBalance: string;
  @Output() transactionComplete = new EventEmitter();
  @ViewChild('belowSection') belowSection: MdbCollapseDirective;

  depositAmount: number | null = null;
  withdrawAmount: number | null = null;
  moveAmount: number | null = null;
  moveDays: number | null = null;

  estimatedDepositUnlock: Date | null = null;
  estimatedMoveUnlock: Date | null = null;
  isWithdrawLocked = false;

  constructor(
    private terrajs: TerrajsService,
    private token: TokenService,
    private gov: GovService,
    private ga: GoogleAnalyticsService,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.detail) {
      this.isWithdrawLocked = Date.now() < changes.detail.currentValue.unlockAt?.getTime();
    }
  }

  async submitDeposit() {
    if (this.depositAmount <= 0) {
      return;
    }

    this.ga.event('CLICK_STAKE_SPEC_' + this.detail.days);

    await this.token.handle(this.terrajs.settings.specToken, {
      send: {
        amount: times(this.depositAmount, CONFIG.UNIT),
        contract: this.terrajs.settings.gov,
        msg: toBase64({ stake_tokens: { days: this.detail.days } }),
      },
    });

    this.reset();
    this.transactionComplete.emit();
  }

  async submitWithdraw() {
    if (this.withdrawAmount <= 0) {
      return;
    }

    this.ga.event('CLICK_UNSTAKE_SPEC_' + this.detail.days);

    await this.gov.withdraw(times(this.withdrawAmount, CONFIG.UNIT), this.detail.days);

    this.reset();
    this.transactionComplete.emit();
  }

  async submitMove() {
    if (this.moveAmount <= 0 || !this.moveDays) {
      return;
    }

    this.ga.event(`CLICK_MOVE_LOCK_${this.moveDays}`);

    await this.gov.updateStake(times(this.moveAmount, CONFIG.UNIT), this.detail.days, this.moveDays);

    this.reset();
    this.transactionComplete.emit();
  }

  toggleExpanded() {
    this.belowSection.toggle();
  }

  reset() {
    this.depositAmount = null;
    this.withdrawAmount = null;
    this.moveAmount = null;
    this.moveDays = null;
  }

  onActiveTabChange() {
    if (this.detail.moveOptions.length === 1 && !this.moveDays) {
      this.moveDays = this.detail.moveOptions[0].days;
    }
  }

  calculateDepositUnlock() {
    if (this.depositAmount <= 0) {
      this.estimatedDepositUnlock = null;
      return;
    }

    this.estimatedDepositUnlock = this.calculateUnlock(
      { amount: this.depositAmount, days: 0 },
      { amount: +this.detail.userBalance, days: this.detail.days, unlockAt: this.detail.unlockAt });
  }

  calculateMoveUnlock() {
    const moveOption = this.detail.moveOptions.find(o => o.days === this.moveDays);

    if (!moveOption || this.moveAmount <= 0) {
      this.estimatedMoveUnlock = null;
      return;
    }

    this.estimatedMoveUnlock = this.calculateUnlock(
      { amount: this.moveAmount, days: this.detail.days, unlockAt: this.detail.unlockAt },
      { amount: +moveOption.userBalance, days: moveOption.days, unlockAt: moveOption.unlockAt });
  }

  private calculateUnlock(from: { amount: number, days: number, unlockAt?: Date }, to: { amount: number, days: number, unlockAt?: Date }) {
    const now = Date.now();
    const fromUnlockTime = from.unlockAt?.getTime() || 0;
    const toUnlockTime = to.unlockAt?.getTime() || 0;
    const fromLock = Math.max(fromUnlockTime - now, 0) + (to.days - from.days) * 60 * 60 * 24 * 1000;
    const toLock = Math.max(toUnlockTime - now, 0);
    const newAmount = from.amount + to.amount;

    if (!newAmount) {
      return null;
    }

    const newLock = (from.amount * fromLock + to.amount * toLock) / newAmount;

    return newLock ? new Date(now + newLock) : null;
  }

  async doClaimReward(ust: boolean) {
    this.ga.event('CLICK_CLAIM_' + (ust ? 'UST' : 'AUST'));

    const aust_amount = times(this.detail.userAUst, CONFIG.UNIT);
    const messages: Msg[] = [];
    messages.push(new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.gov,
      {
        harvest: {
          aust_amount: times(this.detail.userAUst, CONFIG.UNIT),
          days: this.detail.days,
        }
      }));

    if (ust) {
      messages.push(new MsgExecuteContract(
        this.terrajs.address,
        this.terrajs.settings.austToken,
        {
          send: {
            contract: this.terrajs.settings.anchorMarket,
            amount: aust_amount,
            msg: toBase64({redeem_stable: {}})
          }
        }
      ));
    }

    await this.terrajs.post(messages);

    this.transactionComplete.emit();
  }
}
