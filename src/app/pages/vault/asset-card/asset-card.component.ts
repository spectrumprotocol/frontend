import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Coin, Coins, Denom, MsgExecuteContract } from '@terra-money/terra.js';
import { fade } from '../../../consts/animations';
import { CONFIG } from '../../../consts/config';
import { toBase64 } from '../../../libs/base64';
import { floor, gt, times } from '../../../libs/math';
import { TerrajsService } from '../../../services/terrajs.service';
import { Vault } from '../vault.component';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { InfoService } from '../../../services/info.service';
import { MdbCollapseDirective } from 'mdb-angular-ui-kit';
import { Subscription } from 'rxjs';
import BigNumber from 'bignumber.js';
import { debounce } from 'utils-decorators';

@Component({
  selector: 'app-asset-card',
  templateUrl: './asset-card.component.html',
  styleUrls: ['./asset-card.component.scss'],
  animations: [fade]
})
export class AssetCardComponent implements OnInit, OnDestroy {

  @Input() vault: Vault;
  @ViewChild('formDeposit') formDeposit: NgForm;
  @ViewChild('formWithdraw') formWithdraw: NgForm;
  @ViewChild('belowSection') belowSection: MdbCollapseDirective;

  UNIT = CONFIG.UNIT;

  depositAmt: number;
  depositType: string;
  withdrawAmt: number;
  amountUST: number;
  grossLp: string;
  depositFee: string;
  netLp: string;
  height: number;

  private heightChanged: Subscription;

  constructor(
    public terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
    public info: InfoService,
  ) { }

  ngOnInit() {
    this.terrajs.getHeight().then(h => this.height = h);
    this.heightChanged = this.terrajs.heightChanged.subscribe(async () => {
      if (this.terrajs.isConnected && this.belowSection && !this.belowSection.collapsed) {
        await this.info.refreshPoolInfo(this.vault.assetToken);
        if (this.depositAmt) {
          this.depositChanged();
        }
      }
    });
  }

  ngOnDestroy() {
    this.heightChanged.unsubscribe();
  }

  setMaxDeposit() {
    this.depositAmt = +this.info.tokenBalances?.[this.vault.assetToken] / CONFIG.UNIT;
    this.depositChanged();
  }

  setMaxWithdrawLP() {
    const rewardInfo = this.info.rewardInfos?.[this.vault.assetToken];
    if (rewardInfo) {
      this.withdrawAmt = +rewardInfo.bond_amount / CONFIG.UNIT;
    }
  }

  @debounce(250)
  async depositChanged() {
    if (!this.depositAmt) {
      this.amountUST = undefined;
      this.grossLp = undefined;
      this.depositFee = undefined;
      this.netLp = undefined;
    }
    const pool = this.info.poolResponses[this.vault.assetToken];
    const [asset, ust] = pool.assets[0].info.native_token ? [pool.assets[1], pool.assets[0]] : [pool.assets[0], pool.assets[1]];
    const amountUST = new BigNumber(this.depositAmt)
      .times(this.UNIT)
      .times(ust.amount)
      .div(asset.amount)
      .integerValue();

    const grossLp = gt(pool.total_share, 0)
      ? BigNumber.minimum(
        new BigNumber(this.amountUST).times(pool.total_share).div(ust.amount),
        new BigNumber(this.depositAmt).times(pool.total_share).div(asset.amount))
      : new BigNumber(this.depositAmt)
        .times(this.amountUST)
        .sqrt()
    const depositTVL = new BigNumber(amountUST).multipliedBy("2");
    const depositFee = this.vault.poolInfo.farm === "Spectrum" ? new BigNumber("0") :
      grossLp.multipliedBy(new BigNumber("1").minus(depositTVL.dividedBy(depositTVL.plus(this.vault.pairStat.tvl))).multipliedBy("0.001"));
    this.netLp = grossLp.minus(depositFee).toString();
    this.grossLp = grossLp.toString();
    this.depositFee = depositFee.toString();

    const tax = await this.terrajs.lcdClient.utils.calculateTax(Coin.fromData({ amount: amountUST.toString(), denom: 'uusd' }));
    this.amountUST = amountUST.plus(tax.amount.toString())
      .div(this.UNIT)
      .toNumber();
  }

  async doDeposit() {
    if (this.formDeposit.invalid) {
      return;
    }
    if (this.vault.poolInfo.auto_compound && !this.depositType) {
      return;
    }
    this.$gaService.event('CLICK_DEPOSIT_LP_VAULT', this.depositType, this.vault.symbol + '-UST');
    const assetAmount = times(this.depositAmt, this.UNIT);
    const ustAmount = times(this.amountUST, this.UNIT);
    const asset = {
      amount: assetAmount,
      info: {
        token: {
          contract_addr: this.vault.assetToken,
        }
      }
    };
    const ust = {
      amount: ustAmount,
      info: {
        native_token: {
          denom: Denom.USD
        }
      }
    };
    const pool = this.info.poolResponses[this.vault.assetToken];
    const assets = pool.assets[0].info.native_token ? [ust, asset] : [asset, ust];
    await this.terrajs.post([
      new MsgExecuteContract(
        this.terrajs.address,
        this.vault.assetToken,
        {
          increase_allowance: {
            amount: assetAmount,
            spender: this.terrajs.settings.staker,
          }
        }
      ),
      new MsgExecuteContract(
        this.terrajs.address,
        this.terrajs.settings.staker,
        {
          bond: {
            assets,
            compound_rate: this.depositType === 'compound' ? '1' : undefined,
            contract: this.vault.poolInfo.farmContract,
            slippage_tolerance: '0.005'
          }
        },
        new Coins([new Coin(Denom.USD, ustAmount)])
      )
    ]);
    this.depositAmt = undefined;
    this.amountUST = undefined;
    this.netLp = undefined;
    this.depositFee = undefined;
    this.netLp = undefined;
    this.depositType = undefined;
  }

  async doWithdraw() {
    if (this.formWithdraw.invalid) {
      return;
    }
    this.$gaService.event('CLICK_WITHDRAW_LP_VAULT', this.vault.poolInfo.farm.toUpperCase(), this.vault.symbol + '-UST');
    await this.terrajs.post([
      new MsgExecuteContract(
        this.terrajs.address,
        this.vault.poolInfo.farmContract,
        {
          unbond: {
            asset_token: this.vault.poolInfo.asset_token,
            amount: times(this.withdrawAmt, CONFIG.UNIT),
          }
        }
      ),
      new MsgExecuteContract(
        this.terrajs.address,
        this.vault.pairInfo.liquidity_token, {
        send: {
          amount: times(this.withdrawAmt, CONFIG.UNIT),
          contract: this.vault.pairInfo.contract_addr,
          msg: toBase64({ withdraw_liquidity: {} }),
        }
      })
    ]);
    this.withdrawAmt = undefined;
  }

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

  async doClaimReward(all?: boolean) {
    this.$gaService.event('CLICK_CLAIM_REWARD', this.vault.poolInfo.farm, this.vault.symbol + '-UST');
    const mintMsg = new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.gov,
      {
        mint: {}
      }
    );
    await this.terrajs.post([mintMsg, this.getWithdrawMsg(all)]);
  }

  async doMoveToGov(all?: boolean) {
    let pending_spec_reward = 0;
    let pending_farm_reward = 0;
    if (!all) {
      pending_spec_reward = +this.info.rewardInfos[this.vault.assetToken]?.pending_spec_reward;
      if (this.vault.poolInfo.farm !== 'Spectrum') {
        pending_farm_reward = +this.info.rewardInfos[this.vault.assetToken]?.pending_farm_reward;
      }
    } else {
      const rewardInfosKeys = Object.keys(this.info.rewardInfos);

      for (const key of rewardInfosKeys) {
        if (this.info.rewardInfos[key].farm === this.vault.poolInfo.farm) {
          pending_spec_reward += +this.info.rewardInfos[key].pending_spec_reward;
          pending_farm_reward += +this.info.rewardInfos[key].pending_farm_reward;
        }
      }
    }
    if (pending_spec_reward > 0 || pending_farm_reward > 0) {
      const msgs: MsgExecuteContract[] = [];
      msgs.push(this.getWithdrawMsg(all));
      if (pending_spec_reward > 0) {
        const foundSpecFarm = this.info.farmInfos.find(farmInfo => farmInfo.farm === 'Spectrum');
        msgs.push(foundSpecFarm.getStakeGovMsg(floor(pending_spec_reward)));
      }
      if (pending_farm_reward > 0) {
        const foundFarm = this.info.farmInfos.find(farmInfo => farmInfo.farm === this.vault.poolInfo.farm);
        msgs.push(foundFarm.getStakeGovMsg(floor(pending_farm_reward)));
      }
      await this.terrajs.post(msgs);
    }

  }
}
