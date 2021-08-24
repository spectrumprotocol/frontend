import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { fade } from '../../consts/animations';
import { toBase64 } from '../../libs/base64';
import { times } from '../../libs/math';
import { GovService } from '../../services/api/gov.service';
import { TokenService } from '../../services/api/token.service';
import { TerrajsService } from '../../services/terrajs.service';
import {CONFIG} from '../../consts/config';
import {GoogleAnalyticsService} from 'ngx-google-analytics';
import {InfoService} from '../../services/info.service';
import { SpecFarmInfoService } from 'src/app/services/farm_info/spec.farm-info.service';

@Component({
  selector: 'app-gov-stake',
  templateUrl: './gov-stake.component.html',
  styleUrls: ['./gov-stake.component.scss'],
  animations: [fade],
  providers: [SpecFarmInfoService]
})
export class GovStakeComponent implements OnInit, OnDestroy {

  amount: number;
  maxAmount = 0;
  lockedAmount = 0;
  connected: Subscription;
  type: 'Stake' | 'Unstake';

  @ViewChild('form') form: NgForm;

  constructor(
    private gov: GovService,
    private router: Router,
    private terrajs: TerrajsService,
    private token: TokenService,
    protected $gaService: GoogleAnalyticsService,
    private specFarmInfo: SpecFarmInfoService,
  ) { }

  ngOnInit(): void {
    this.type = this.router.url === '/gov/stake'
      ? 'Stake'
      : 'Unstake';
    this.connected = this.terrajs.connected
      .subscribe(connected => {
        if (connected) {
          this.updateBalance();
        }
      });
  }

  private updateBalance() {
    if (this.type === 'Stake') {
      this.token.balance(this.terrajs.settings.specToken)
            .then(it => this.maxAmount = +it.balance / CONFIG.UNIT);
    } else {
      this.gov.balance()
            .then(it => {
              const locked = it.locked_balance.reduce((a, b) => Math.max(a, +b[1].balance), 0);
              this.maxAmount = (+it.balance - locked) / CONFIG.UNIT;
              this.lockedAmount = locked / CONFIG.UNIT;
            });
    }
  }

  ngOnDestroy(): void {
    this.connected.unsubscribe();
  }

  setMax() {
    this.amount = this.maxAmount;
  }

  async submit() {
    if (this.form.invalid) {
      return;
    }

    if (this.type === 'Stake') {
      this.$gaService.event('CLICK_STAKE_SPEC');
      const stakeMsg = this.specFarmInfo.getStakeGovMsg(times(this.amount, CONFIG.UNIT));
      await this.terrajs.post(stakeMsg);
    } else {
      this.$gaService.event('CLICK_UNSTAKE_SPEC');
      await this.gov.handle({
        withdraw: {
          amount: times(this.amount, CONFIG.UNIT)
        }
      });
    }

    this.router.navigateByUrl('/gov');
  }
}
