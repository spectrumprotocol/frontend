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

const DEPOSIT_FEE = '0.001';
import { Denom } from '../../../consts/denom';

@Component({
  selector: 'app-asset-card',
  templateUrl: './asset-card.component.html',
  styleUrls: ['./asset-card.component.scss'],
  animations: [fade],
  providers: [LpBalancePipe]
})
export class AssetCardComponent implements OnInit, OnDestroy {

  @Input() vault: Vault;
  @ViewChild('formDeposit') formDeposit: NgForm;
  @ViewChild('formWithdraw') formWithdraw: NgForm;
  @ViewChild('belowSection') belowSection: MdbCollapseDirective;

  UNIT = CONFIG.UNIT;

  depositTokenAmtTokenUST: number;
  depositUSTAmountTokenUST: number;
  depositLPAmtLP: number;
  depositUSTAmtUST: number;

  depositType: 'compound' | 'stake' | 'mixed';
  depositMode: 'tokenust' | 'lp' | 'ust' = 'tokenust';
  withdrawMode: 'tokenust' | 'lp' = 'tokenust';

  withdrawAmt: number;
  grossLpTokenUST: string;
  depositFeeTokenUST: string;
  netLpTokenUST: string;

  depositFeeLp: string;
  netLpLp: string;

  grossLpUST: string;
  depositFeeUST: string;
  netLpUST: string;

  depositUSTBeliefPriceBuy: string;
  depositUSTFoundPoolAddress: string;

  height: number;

  private heightChanged: Subscription;
  auto_compound_percent_deposit = 50;
  auto_compound_percent_reallocate: number;
  ngx_slider_option: NgxSliderOptions = {
    animate: false,
    step: 1,
    tickStep: 10,
    floor: 0,
    ceil: 100,
    showTicksValues: false,
    hideLimitLabels: true,
  };
  bufferUST = 3.5;

  constructor(
    public terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
    public info: InfoService,
    private lpBalancePipe: LpBalancePipe,
    private tokenService: TokenService,
    private terraSwapService: TerraSwapService,
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
  }

  ngOnDestroy() {
    this.heightChanged.unsubscribe();
  }

  toggleAssetCard() {
    this.belowSection.toggle();
    if (isNaN(this.auto_compound_percent_reallocate)) {
      this.auto_compound_percent_reallocate = Math.round(+this.info.rewardInfos[this.vault.assetToken]?.auto_bond_amount / +this.info.rewardInfos[this.vault.assetToken]?.bond_amount * 100);
    }
  }

  setMaxDepositUSTToken() {
    this.depositTokenAmtTokenUST = +this.info.tokenBalances?.[this.vault.assetToken] / CONFIG.UNIT;
    this.depositTokenUSTChanged();
  }

  setMaxWithdrawLP() {
    const rewardInfo = this.info.rewardInfos?.[this.vault.assetToken];
    if (rewardInfo) {
      this.withdrawAmt = +rewardInfo.bond_amount / CONFIG.UNIT;
    }
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

  async doDeposit() {
    if (this.vault.poolInfo.auto_compound && !this.depositType) {
      return;
    }
    this.$gaService.event('CLICK_DEPOSIT_LP_VAULT', `${this.depositType}, ${this.depositMode}`, this.vault.symbol + '-UST');

    let auto_compound_ratio: string;
    if (this.depositType === 'compound') {
      auto_compound_ratio = '1';
    } else if (this.depositType === 'stake' || !this.vault.poolInfo.auto_compound) {
      auto_compound_ratio = undefined;
    } else if (this.depositType === 'mixed') {
      auto_compound_ratio = (this.auto_compound_percent_deposit / 100).toString();
    } else {
      return;
    }

    if (this.depositMode === 'tokenust') {
      const assetAmount = times(this.depositTokenAmtTokenUST, this.UNIT);
      const ustAmount = times(this.depositUSTAmountTokenUST, this.UNIT);
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
              compound_rate: auto_compound_ratio,
              contract: this.vault.poolInfo.farmContract,
              slippage_tolerance: '0.01'
            }
          },
          new Coins([new Coin(Denom.USD, ustAmount)])
        )
      ]);
    } else if (this.depositMode === 'lp') {
      const lpAmount = times(this.depositLPAmtLP, this.UNIT);
      const farmContract = this.info.farmInfos.find(farmInfo => farmInfo.farm === this.vault.poolInfo.farm)?.farmContract;
      await this.tokenService.handle(this.vault.lpToken, {
        send: {
          amount: lpAmount,
          contract: farmContract,
          msg: toBase64({
            bond: {
              asset_token: this.vault.assetToken,
              compound_rate: this.vault.poolInfo.auto_compound ? auto_compound_ratio : undefined
            }
          })
        }
      });
    } else if (this.depositMode === 'ust') {
      const farmContract = this.info.farmInfos.find(farmInfo => farmInfo.farm === this.vault.poolInfo.farm)?.farmContract;
      const depositUST = times(this.depositUSTAmtUST, CONFIG.UNIT);
      const coin = new Coin(Denom.USD, depositUST);
      const msgs = new MsgExecuteContract(this.terrajs.address, this.terrajs.settings.staker, {
        zap_to_bond: {
          contract: farmContract,
          provide_asset: {
            info: {
              native_token: {
                denom: Denom.USD
              }
            },
            amount: depositUST
          },
          pair_asset: {
            token: {
              contract_addr: this.vault.assetToken
            },
          },
          belief_price: this.depositUSTBeliefPriceBuy,
          max_spread: '0.01',
          compound_rate: auto_compound_ratio
        }
      }, new Coins([coin])
      );
      await this.terrajs.post(msgs);
    }

    this.depositTokenAmtTokenUST = undefined;
    this.depositUSTAmountTokenUST = undefined;
    this.depositUSTAmtUST = undefined;

    this.netLpTokenUST = undefined;
    this.depositFeeTokenUST = undefined;
    this.netLpTokenUST = undefined;

    this.depositFeeLp = undefined;
    this.netLpLp = undefined;

    this.grossLpUST = undefined;
    this.depositFeeUST = undefined;
    this.netLpUST = undefined;

    this.depositType = undefined;
  }

  async doWithdraw() {
    if (this.formWithdraw.invalid) {
      return;
    }
    this.$gaService.event('CLICK_WITHDRAW_LP_VAULT', this.vault.poolInfo.farm.toUpperCase(), this.vault.symbol + '-UST');
    const unbond = new MsgExecuteContract(
      this.terrajs.address,
      this.vault.poolInfo.farmContract,
      {
        unbond: {
          asset_token: this.vault.poolInfo.asset_token,
          amount: times(this.withdrawAmt, CONFIG.UNIT),
        }
      }
    );
    const withdrawLp = new MsgExecuteContract(
      this.terrajs.address,
      this.vault.pairInfo.liquidity_token, {
      send: {
        amount: times(this.withdrawAmt, CONFIG.UNIT),
        contract: this.vault.pairInfo.contract_addr,
        msg: toBase64({ withdraw_liquidity: {} }),
      }
    }
    );
    if (this.withdrawMode === 'tokenust') {
      await this.terrajs.post([unbond, withdrawLp]);
    } else if (this.withdrawMode === 'lp') {
      await this.terrajs.post([unbond]);
    }
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

  getMintMsg(): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.gov,
      {
        mint: {}
      }
    );
  }

  async doClaimReward(all?: boolean) {
    this.$gaService.event('CLICK_CLAIM_REWARD', this.vault.poolInfo.farm, this.vault.symbol + '-UST');
    await this.terrajs.post([this.getMintMsg(), this.getWithdrawMsg(all)]);
  }

  async doMoveToGov(all?: boolean) {
    this.$gaService.event('CLICK_MOVE_TO_GOV_ASSET_CARD', this.vault.poolInfo.farm, this.vault.symbol + '-UST');
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
      const msgs: MsgExecuteContract[] = [this.getMintMsg()];
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

  inputAutoCompoundPercent(event: any, reversed: boolean, target: string) {
    let value = event?.target?.value || 0;
    if (value < 0) {
      value = 0;
      event.target.value = value;
    }
    if (value > 100) {
      value = 100;
      event.target.value = value;
    }
    if (reversed) {
      value = 100 - value;
    }
    if (target === 'deposit') {
      this.auto_compound_percent_deposit = value;
      this.autoCompoundChanged();
    } else if (target === 'reallocate') {
      this.auto_compound_percent_reallocate = value;
    }
  }

  autoCompoundChanged() {
    const percent = this.auto_compound_percent_deposit / 100;
    this.vault['totalMixApy'] = this.vault.stakeApy * (1 - percent) + this.vault.compoundApy * percent;
    this.vault['mixApy'] = this.vault['totalMixApy'] - this.vault.specApy;
  }

  @debounce(250)
  async depositLPChanged() {
    if (!this.depositLPAmtLP) {
      this.depositLPAmtLP = undefined;
      this.depositFeeLp = undefined;
      this.netLpLp = undefined;
    }
    const grossLp = new BigNumber(this.depositLPAmtLP);
    const depositTVL = new BigNumber(this.lpBalancePipe.transform(times(this.depositLPAmtLP, CONFIG.UNIT) ?? '0', this.info.poolResponses[this.vault.assetToken]));
    const depositFee = this.vault.poolInfo.farm === 'Spectrum' ? new BigNumber('0') :
      grossLp.multipliedBy(new BigNumber('1').minus(depositTVL.dividedBy(depositTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
    this.netLpLp = grossLp.minus(depositFee).toString();
    this.depositFeeLp = depositFee.toString();
  }

  setMaxDepositLP() {
    this.depositLPAmtLP = +this.info.lpTokenBalances?.[this.vault.lpToken] / CONFIG.UNIT;
    this.depositLPChanged();
  }

  @debounce(250)
  async depositUSTChanged() {
    if (!this.depositUSTAmtUST) {
      this.depositUSTAmtUST = undefined;
      this.grossLpUST = undefined;
      this.depositFeeUST = undefined;
      this.netLpUST = undefined;
    }
    await this.info.ensureCw20Pairs();
    const poolAddresses = Object.keys(this.info.cw20Pairs[this.terrajs?.network?.name ?? 'mainnet']);
    if (!this.depositUSTFoundPoolAddress) {
      for (const poolAddress of poolAddresses) {
        const pair = this.info.cw20Pairs[this.terrajs?.network?.name ?? 'mainnet'][poolAddress];
        if (pair[0] === this.vault.assetToken || pair[1] === this.vault.assetToken) {
          this.depositUSTFoundPoolAddress = poolAddress;
          break;
        }
      }
    }
    const halfUSTbeforeTax = floor(div(times(this.depositUSTAmtUST, CONFIG.UNIT), 2));
    const tax = await this.terrajs.lcdClient.utils.calculateTax(
      Coin.fromData({ amount: halfUSTbeforeTax, denom: 'uusd' }));
    const halfUST = div(minus(halfUSTbeforeTax, tax.amount.toString()), CONFIG.UNIT);
    if (this.depositUSTFoundPoolAddress) {
      const simulateSwapUSTtoToken = {
        simulation: {
          offer_asset: {
            amount: times(halfUST, CONFIG.UNIT),
            info: {
              native_token: {
                denom: Denom.USD
              }
            }
          }
        }
      };
      const simulateSwapUSTtoTokenResult = await this.terraSwapService.query(this.depositUSTFoundPoolAddress, simulateSwapUSTtoToken);
      this.depositUSTBeliefPriceBuy = floor18Decimal(times(div(halfUST, simulateSwapUSTtoTokenResult.return_amount), CONFIG.UNIT));

      const pool = this.info.poolResponses[this.vault.assetToken];
      const [asset, ust] = pool.assets[0].info.native_token ? [pool.assets[1], pool.assets[0]] : [pool.assets[0], pool.assets[1]];

      const grossLp = gt(pool.total_share, 0)
        ? BigNumber.minimum(
          new BigNumber(halfUST).times(pool.total_share).div(ust.amount),
          new BigNumber(simulateSwapUSTtoTokenResult.return_amount).div(CONFIG.UNIT).times(pool.total_share).div(asset.amount))
        : new BigNumber(halfUST)
          .times(simulateSwapUSTtoTokenResult.return_amount)
          .sqrt();
      const depositTVL = new BigNumber(halfUST).multipliedBy('2');
      const depositFee = this.vault.poolInfo.farm === 'Spectrum' ? new BigNumber('0') :
        grossLp.multipliedBy(new BigNumber('1').minus(depositTVL.dividedBy(depositTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
      this.netLpUST = grossLp.minus(depositFee).toString();
      this.grossLpUST = grossLp.toString();
      this.depositFeeUST = depositFee.toString();
    }
  }

  setMaxDepositUST() {
    if (+this.info.userUstAmount > this.bufferUST){
      this.depositUSTAmtUST = +floorSixDecimal(+this.info.userUstAmount - 3.5);
    }
    this.depositUSTChanged();
  }

  private calcNewStakeOrCompoundAmount(mode: string) {
    if (+this.info.rewardInfos[this.vault.assetToken]?.bond_amount < 10) {
      return '0';
    } else if (mode === 'stake') {
      return times(this.info.rewardInfos[this.vault.assetToken]?.bond_amount, (100 - this.auto_compound_percent_reallocate) / 100);
    } else if (mode === 'compound') {
      return times(this.info.rewardInfos[this.vault.assetToken]?.bond_amount, (this.auto_compound_percent_reallocate) / 100);
    }
  }

  async doReallocate() {
    const farmContract = this.info.farmInfos.find(farmInfo => farmInfo.farm === this.vault.poolInfo.farm)?.farmContract;
    const msgs = [new MsgExecuteContract(
      this.terrajs.address,
      farmContract,
      {
        update_bond: {
          asset_token: this.vault.poolInfo.asset_token,
          amount_to_stake: floor(this.calcNewStakeOrCompoundAmount('stake')),
          amount_to_auto: floor(this.calcNewStakeOrCompoundAmount('compound'))
        }
      }
    )];
    await this.terrajs.post(msgs);
  }

  changeDepositMode(mode: 'tokenust' | 'lp' | 'ust') {
    setTimeout(() => this.depositMode = mode, 0);
  }
}
