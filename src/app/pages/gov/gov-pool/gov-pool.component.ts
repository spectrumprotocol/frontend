import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { CONFIG } from 'src/app/consts/config';
import { toBase64 } from 'src/app/libs/base64';
import { times } from 'src/app/libs/math';
import { GovService } from 'src/app/services/api/gov.service';
import { TokenService } from 'src/app/services/api/token.service';
import { TerrajsService } from 'src/app/services/terrajs.service';

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
  userAvailableBalance: string;
  unlockAt: Date | null;
  moveOptions: { days: number; userBalance: string; unlockAt: Date | null }[];
}

@Component({
  selector: 'app-gov-pool',
  templateUrl: './gov-pool.component.html',
  styleUrls: ['./gov-pool.component.scss'],
})
export class GovPoolComponent {
  @Input() detail: GovPoolDetail;
  @Input() walletBalance: string;
  @Output() transactionComplete = new EventEmitter();

  _depositAmount: number | null = null;
  _withdrawAmount: number | null = null;
  _moveAmount: number | null = null;
  _moveDays: number | null = null;

  isExpanded = false;
  get depositAmount() { return this._depositAmount; }
  get withdrawAmount() { return this._withdrawAmount; }
  get moveAmount() { return this._moveAmount; }
  get moveDays() { return this._moveDays; }
  estimatedDepositUnlock: Date | null = null;
  estimatedMoveUnlock: Date | null = null;
  isWithdrawLocked = false;

  constructor(
    private terrajsService: TerrajsService,
    private tokenService: TokenService,
    private govService: GovService,
    private gaService: GoogleAnalyticsService
  ) { }

  set depositAmount(value) {
    this._depositAmount = value;
    this.calculateDepositUnlock();
  }

  set withdrawAmount(value) {
    this._withdrawAmount = value;
  }

  set moveAmount(value) {
    this._moveAmount = value;
    this.calculateMoveUnlock();
  }

  set moveDays(value) {
    this._moveDays = value;
    this.calculateMoveUnlock();
  }

  async submitDeposit() {
    if (this.depositAmount <= 0) {
      return;
    }

    this.gaService.event('CLICK_STAKE_SPEC');

    await this.tokenService.handle(this.terrajsService.settings.specToken, {
      send: {
        amount: times(this.depositAmount, CONFIG.UNIT),
        contract: this.terrajsService.settings.gov,
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

    this.gaService.event('CLICK_UNSTAKE_SPEC');

    await this.govService.withdraw(times(this.withdrawAmount, CONFIG.UNIT), this.detail.days);

    this.reset();
    this.transactionComplete.emit();
  }

  async submitMove() {
    if (this.moveAmount <= 0 || !this.moveDays) {
      return;
    }

    this.gaService.event(`CLICK_MOVE_LOCK_${this.moveDays}`);

    await this.govService.updateStake(times(this.moveAmount, CONFIG.UNIT), this.detail.days, this.moveDays);

    this.reset();
    this.transactionComplete.emit();
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  reset() {
    this.depositAmount = null;
    this.withdrawAmount = null;
    this.moveAmount = null;
    this.moveDays = null;
  }

  onActiveTabChange() {
    this.isWithdrawLocked = Date.now() < this.detail.unlockAt?.getTime();

    if (this.detail.moveOptions.length && !this.moveDays) {
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
    const fromLock = Math.max(fromUnlockTime - now, 0) + (to.days - from.days) * 60 * 60 * 24;
    const toLock = Math.max(toUnlockTime - now, 0);
    const newAmount = from.amount + to.amount;

    if (!newAmount) {
      return null;
    }

    const newLock = (from.amount * fromLock + to.amount * toLock) / newAmount;

    return newLock ? new Date(now + newLock) : null;
  }
}
