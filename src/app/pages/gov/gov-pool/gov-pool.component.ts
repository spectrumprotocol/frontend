import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MdbTabChange } from 'mdb-angular-ui-kit/tabs/tabs.component';

export enum GovPoolTab {
  Deposit,
  Move,
  Withdraw,
}

export interface GovPoolDetail {
  days: number;
  balance: bigint;
  apr: number;
  userBalance: bigint;
  unlock: number;
  moveOptions: { days: number; userBalance: bigint; unlock: number }[];
}

@Component({
  selector: 'app-gov-pool',
  templateUrl: './gov-pool.component.html',
  styleUrls: ['./gov-pool.component.scss'],
})
export class GovPoolComponent implements OnInit {
  @Input() detail: GovPoolDetail;
  @Input() walletBalance: bigint;
  @Output() deposit = new EventEmitter<bigint>();
  @Output() withdraw = new EventEmitter<bigint>();
  @Output() move = new EventEmitter<{ amount: bigint, days: number }>();
  @Output() tabChange = new EventEmitter<GovPoolTab>();

  isExpanded = false;
  depositAmount = new FormControl();
  withdrawAmount = new FormControl();
  moveAmount = new FormControl();
  moveDays = new FormControl();

  estimatedDepositUnlock = 0;
  estimatedMoveUnlock = 0;

  ngOnInit() {
    this.depositAmount.valueChanges.subscribe(() => { this.calculateDepositUnlock(); });
    this.moveAmount.valueChanges.subscribe(() => { this.calculateMoveUnlock(); });
    this.moveDays.valueChanges.subscribe(() => { this.calculateMoveUnlock(); });
  }

  submitDeposit() {
    const amount = this.depositAmount.value;

    if (amount <= 0) {
      return;
    }

    this.deposit.emit(amount);
  }

  submitWithdraw() {
    const amount = this.withdrawAmount.value;

    if (amount <= 0) {
      return;
    }

    this.withdraw.emit(amount);
  }

  submitMove() {
    const amount = this.moveAmount.value;
    const days = this.moveDays.value;

    if (amount <= 0 || !days) {
      return;
    }

    this.move.emit({ amount, days });
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  reset() {
    this.isExpanded = false;
    this.depositAmount.reset();
    this.withdrawAmount.reset();
    this.moveAmount.reset();
    this.moveDays.reset();
  }

  onActiveTabChange(event: MdbTabChange) {
    this.tabChange.emit(event.index);

    if (event.index === GovPoolTab.Move && !this.moveDays.value) {
      this.moveDays.setValue(this.detail.moveOptions[0].days);
    }
  }

  calculateDepositUnlock() {
    if (this.depositAmount.value <= 0) {
      this.estimatedDepositUnlock = 0;
      return;
    }

    this.estimatedDepositUnlock = this.calculateUnlock(
      { amount: this.depositAmount.value, days: 0, unlock: 0 },
      { amount: this.detail.userBalance, days: this.detail.days, unlock: this.detail.unlock });
  }

  calculateMoveUnlock() {
    const moveOption = this.detail.moveOptions.find(o => o.days === this.moveDays.value);

    if (!moveOption || this.moveAmount.value <= 0) {
      this.estimatedMoveUnlock = 0;
      return;
    }

    this.estimatedMoveUnlock = this.calculateUnlock(
      { amount: this.moveAmount.value, days: this.detail.days, unlock: this.detail.unlock },
      { amount: moveOption.userBalance, days: moveOption.days, unlock: moveOption.unlock });
  }

  private calculateUnlock(from: { amount: bigint, days: number, unlock: number }, to: { amount: bigint, days: number, unlock: number }) {
    const now = Math.floor(Date.now() / 1000);
    const fromLock = Math.max(from.unlock - now, 0) + (to.days - from.days) * 60 * 60 * 24;
    const toLock = Math.max(to.unlock - now, 0);
    const newAmount = from.amount + to.amount;

    if (!newAmount) {
      return 0;
    }

    const newLock = Number((from.amount * BigInt(fromLock) + to.amount * BigInt(toLock)) / newAmount);

    return newLock > 0 ? now + newLock : 0;
  }
}
