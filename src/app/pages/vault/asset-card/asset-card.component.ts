import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Coin, Coins, MsgExecuteContract } from '@terra-money/terra.js';
import { fade } from '../../../consts/animations';
import { CONFIG } from '../../../consts/config';
import { toBase64 } from '../../../libs/base64';
import {div, floor, floor18Decimal, floorSixDecimal, gt, minus, times} from '../../../libs/math';
import { TerrajsService } from '../../../services/terrajs.service';
import { Vault } from '../vault.component';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { InfoService } from '../../../services/info.service';
import { MdbCollapseDirective } from 'mdb-angular-ui-kit';
import { Subscription } from 'rxjs';
import BigNumber from 'bignumber.js';
import { debounce } from 'utils-decorators';
import { Options as NgxSliderOptions } from '@angular-slider/ngx-slider';
import { LpBalancePipe } from '../../../pipes/lp-balance.pipe';
import { TokenService } from '../../../services/api/token.service';
import { TerraSwapService } from '../../../services/api/terraswap.service';
import { MdbModalModule, MdbModalRef, MdbModalService } from 'mdb-angular-ui-kit';
const DEPOSIT_FEE = '0.001';
import { Denom } from '../../../consts/denom';
import { VaultDialogComponent } from './vault-dialog/vault-dialog.component';

@Component({
  selector: 'app-asset-card',
  templateUrl: './asset-card.component.html',
  styleUrls: ['./asset-card.component.scss'],
  animations: [fade],
  providers: [LpBalancePipe]
})
export class AssetCardComponent implements OnInit, OnDestroy {
  @Input() vault: Vault;
  @Input() isGrid;
  @ViewChild('formDeposit') formDeposit: NgForm;
  @ViewChild('formWithdraw') formWithdraw: NgForm;
  @ViewChild('belowSection') belowSection: MdbCollapseDirective;
  UNIT = CONFIG.UNIT;
  depositTokenAmtTokenUST: number;
  depositUSTAmountTokenUST: number;
  height: number;
  modalRef: MdbModalRef<VaultDialogComponent>;
  private heightChanged: Subscription;
  grossLpTokenUST: string;
  depositFeeTokenUST: string;
  netLpTokenUST: string;
  
  constructor(
    public terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
    public info: InfoService,
    private modalService: MdbModalService
  ) { }

  ngOnInit() {
    this.terrajs.getHeight().then(h => this.height = h);
    this.heightChanged = this.terrajs.heightChanged.subscribe(async () => {
      if (this.terrajs.isConnected && this.belowSection && !this.belowSection.collapsed) {
        await this.info.refreshPoolResponse(this.vault.assetToken);
        if (this.depositTokenAmtTokenUST) {
          this.depositTokenUSTChanged();
        }
      }
    });

    console.log(this.formDeposit);
  }

  ngOnDestroy() {
    this.heightChanged.unsubscribe();
  }

  async openModal() {
    this.modalRef = this.modalService.open(VaultDialogComponent, { 
      modalClass: 'modal-lg modal-dialog-centered',
      data: {
      mockData: this,
      vaultData: this.vault
    }});
  }

  @debounce(250)
  async depositTokenUSTChanged() {
    if (!this.depositTokenAmtTokenUST) {
      this.depositUSTAmountTokenUST = undefined;
      this.grossLpTokenUST = undefined;
      this.depositFeeTokenUST = undefined;
      this.netLpTokenUST = undefined;
    }
    const pool = this.info.poolResponses[this.vault.assetToken];
    const [asset, ust] = pool.assets[0].info.native_token ? [pool.assets[1], pool.assets[0]] : [pool.assets[0], pool.assets[1]];
    const amountUST = new BigNumber(this.depositTokenAmtTokenUST)
      .times(this.UNIT)
      .times(ust.amount)
      .div(asset.amount)
      .integerValue();

    const grossLp = gt(pool.total_share, 0)
      ? BigNumber.minimum(
        new BigNumber(this.depositUSTAmountTokenUST).times(pool.total_share).div(ust.amount),
        new BigNumber(this.depositTokenAmtTokenUST).times(pool.total_share).div(asset.amount))
      : new BigNumber(this.depositTokenAmtTokenUST)
        .times(this.depositUSTAmountTokenUST)
        .sqrt();
    if (this.vault.pairStat) {
      const depositTVL = new BigNumber(amountUST).multipliedBy('2');
      const depositFee = this.vault.poolInfo.farm === 'Spectrum' ? new BigNumber('0') :
        grossLp.multipliedBy(new BigNumber('1').minus(depositTVL.dividedBy(depositTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
      this.netLpTokenUST = grossLp.minus(depositFee).toString();
      this.depositFeeTokenUST = depositFee.toString();
    }
    this.grossLpTokenUST = grossLp.toString();

    const tax = await this.terrajs.lcdClient.utils.calculateTax(Coin.fromData({ amount: amountUST.toString(), denom: 'uusd' }));
    this.depositUSTAmountTokenUST = amountUST.plus(tax.amount.toString())
      .div(this.UNIT)
      .toNumber();
  }
  
  // async doMoveToGov(all?: boolean) {
  //   this.$gaService.event('CLICK_MOVE_TO_GOV_ASSET_CARD', this.vault.poolInfo.farm, this.vault.symbol + '-UST');
  //   let pending_spec_reward = 0;
  //   let pending_farm_reward = 0;
  //   if (!all) {
  //     pending_spec_reward = +this.info.rewardInfos[this.vault.assetToken]?.pending_spec_reward;
  //     if (this.vault.poolInfo.farm !== 'Spectrum') {
  //       pending_farm_reward = +this.info.rewardInfos[this.vault.assetToken]?.pending_farm_reward;
  //     }
  //   } else {
  //     const rewardInfosKeys = Object.keys(this.info.rewardInfos);

  //     for (const key of rewardInfosKeys) {
  //       if (this.info.rewardInfos[key].farm === this.vault.poolInfo.farm) {
  //         pending_spec_reward += +this.info.rewardInfos[key].pending_spec_reward;
  //         pending_farm_reward += +this.info.rewardInfos[key].pending_farm_reward;
  //       }
  //     }
  //   }
  //   if (pending_spec_reward > 0 || pending_farm_reward > 0) {
  //     const msgs: MsgExecuteContract[] = [this.getMintMsg()];
  //     msgs.push(this.getWithdrawMsg(all));
  //     if (pending_spec_reward > 0) {
  //       const foundSpecFarm = this.info.farmInfos.find(farmInfo => farmInfo.farm === 'Spectrum');
  //       msgs.push(foundSpecFarm.getStakeGovMsg(floor(pending_spec_reward)));
  //     }
  //     if (pending_farm_reward > 0) {
  //       const foundFarm = this.info.farmInfos.find(farmInfo => farmInfo.farm === this.vault.poolInfo.farm);
  //       msgs.push(foundFarm.getStakeGovMsg(floor(pending_farm_reward)));
  //     }
  //     await this.terrajs.post(msgs);
  //   }

  // }

  getWithdrawMsg(all?: boolean): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.vault.poolInfo.farmContract,
      {
        withdraw: {
          asset_token: all ? undefined : this.vault.poolInfo.asset_token,
        }
      }
    );
  }

  getMintMsg(): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.gov,
      {
        mint: {}
      }
    );
  }


}
