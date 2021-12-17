import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Coin, Coins, MsgExecuteContract } from '@terra-money/terra.js';
import { fade } from '../../../../consts/animations';
import { CONFIG } from '../../../../consts/config';
import { toBase64 } from '../../../../libs/base64';
import { div, floor, floor18Decimal, floorSixDecimal, gt, minus, times } from '../../../../libs/math';
import { TerrajsService } from '../../../../services/terrajs.service';
import { Vault } from '../../vault.component';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { InfoService } from '../../../../services/info.service';
import { Subscription } from 'rxjs';
import BigNumber from 'bignumber.js';
import { debounce } from 'utils-decorators';
import { Options as NgxSliderOptions } from '@angular-slider/ngx-slider';
import { LpBalancePipe } from '../../../../pipes/lp-balance.pipe';
import { TokenService } from '../../../../services/api/token.service';
import { TerraSwapService } from '../../../../services/api/terraswap.service';
import { Denom } from '../../../../consts/denom';
import { StakerService } from '../../../../services/api/staker.service';
import { ExecuteMsg as StakerExecuteMsg } from '../../../../services/api/staker/execute_msg';
import { MdbModalRef, MdbModalService } from 'mdb-angular-ui-kit/modal';

const DEPOSIT_FEE = '0.001';
export type DEPOSIT_WITHDRAW_MODE_ENUM = 'tokentoken' | 'lp' | 'ust' | 'dptoken';

@Component({
  selector: 'app-vault-dialog',
  templateUrl: './vault-dialog.component.html',
  styleUrls: ['./vault-dialog.component.scss'],
  animations: [fade],
  providers: [LpBalancePipe]
})
export class VaultDialogComponent implements OnInit, OnDestroy {
  vault: Vault;
  @ViewChild('formDeposit') formDeposit: NgForm;
  @ViewChild('formWithdraw') formWithdraw: NgForm;

  UNIT: number = CONFIG.UNIT;
  SLIPPAGE = CONFIG.SLIPPAGE_TOLERANCE;

  depositTokenAAmtTokenToken: number;
  depositUSTAmountTokenUST: number;
  depositLPAmtLP: number;
  depositUSTAmtUST: number;
  depositTokenBAmtTokenToken: number;
  depositDPTokenAmtDPToken: number;
  tokenAToBeStatic = true;

  depositType: 'compound' | 'stake' | 'mixed';
  depositMode: DEPOSIT_WITHDRAW_MODE_ENUM;
  withdrawMode: DEPOSIT_WITHDRAW_MODE_ENUM;

  withdrawAmt: number;
  withdrawUST: string;
  withdrawMinUST: string;
  withdrawTokenPrice: string;
  withdrawBaseTokenPrice: string;

  grossLpTokenUST: string;
  depositFeeTokenUST: string;
  netLpTokenUST: string;

  depositFeeLp: string;
  netLpLp: string;

  grossLpUST: string;
  depositFeeUST: string;
  netLpUST: string;

  tokenPrice: string;
  basedTokenPrice: string;

  private heightChanged: Subscription;
  auto_compound_percent_deposit = 50;
  auto_compound_percent_reallocate = 50;
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
  depositFeeDPToken: string;
  netDPToken: string;
  constructor(
    public modalRef: MdbModalRef<VaultDialogComponent>,
    public terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
    public info: InfoService,
    private lpBalancePipe: LpBalancePipe,
    private tokenService: TokenService,
    private staker: StakerService,
    private terraSwap: TerraSwapService,
    private modalService: MdbModalService) {
  }

  ngOnInit() {
    if (this.vault.poolInfo.farmType === 'LP'){
      this.depositMode = 'tokentoken';
      this.withdrawMode = 'tokentoken';
    } else if (this.vault.poolInfo.farmType === 'PYLON_LIQUID'){
      this.depositMode = 'dptoken';
      this.withdrawMode = 'dptoken';
    }
    this.heightChanged = this.terrajs.heightChanged.subscribe(async () => {
      if (this.terrajs.isConnected) {
        if (this.vault.poolInfo.farmType === 'LP'){
          const tasks: Promise<any>[] = [];
          if (this.vault.poolInfo.pairSymbol !== 'UST') {
            tasks.push(this.info.refreshPoolResponse(this.vault.poolInfo.farmTokenContract));
          }
          tasks.push(this.info.refreshPoolResponse(this.vault.assetToken));
          await Promise.all(tasks);
          if (this.depositTokenAAmtTokenToken && this.tokenAToBeStatic) {
            this.depositTokenATokenTokenChanged(true);
          } else if (this.depositTokenBAmtTokenToken && !this.tokenAToBeStatic) {
            this.depositTokenBTokenTokenChanged(true);
          }
          if (this.withdrawAmt) {
            this.withdrawAmtChanged();
          }
        } else if (this.vault.poolInfo.farmType === 'PYLON_LIQUID'){
          const tasks: Promise<any>[] = [];
          tasks.push(this.info.refreshTokenBalance(this.vault.assetToken));
          await Promise.all(tasks);
        }
      }
    });
    this.refreshData();
  }

  async refreshData() {
    if (this.info.rewardInfos[this.vault.assetToken]) {
      this.auto_compound_percent_reallocate = Math.round(+this.info.rewardInfos[this.vault.assetToken]?.auto_bond_amount / +this.info.rewardInfos[this.vault.assetToken]?.bond_amount * 100);
    }
    if (this.vault.poolInfo.forceDepositType) {
      this.depositType = this.vault.poolInfo.forceDepositType as any;
    }
  }

  ngOnDestroy() {
    this.heightChanged.unsubscribe();
  }

  setMaxDepositTokenATokenToken() {
    this.tokenAToBeStatic = true;
    this.depositTokenAAmtTokenToken = +this.info.tokenBalances?.[this.vault.assetToken] / this.vault.unit;
    this.depositTokenATokenTokenChanged(true);
  }

  setMaxWithdrawLP() {
    const rewardInfo = this.info.rewardInfos?.[this.vault.assetToken];
    if (rewardInfo) {
      this.withdrawAmt = +rewardInfo.bond_amount / CONFIG.UNIT;
    }
    this.withdrawAmtChanged();
  }

  @debounce(250)
  async depositTokenATokenTokenChanged(forced: boolean, event?: any) {
    if (!forced && !event) {
      // input from from HTML has event, input from ngModel changes does not have event, trick to prevent bounce
      return;
    }
    if (event) {
      this.tokenAToBeStatic = true;
    }
    if (!this.depositTokenAAmtTokenToken) {
      this.depositUSTAmountTokenUST = undefined;
      this.depositTokenBAmtTokenToken = undefined;
      this.grossLpTokenUST = undefined;
      this.depositFeeTokenUST = undefined;
      this.netLpTokenUST = undefined;
    }
    this.refreshDataTokenToken(true);
  }

  @debounce(250)
  async depositTokenBTokenTokenChanged(forced: boolean, event?: any) {
    if (!forced && !event) {
      // input from from HTML has event, input from ngModel changes does not have event, trick to prevent bounce
      return;
    }
    if (event) {
      this.tokenAToBeStatic = false;
    }
    if (!this.depositTokenBAmtTokenToken) {
      this.depositUSTAmountTokenUST = undefined;
      this.depositTokenAAmtTokenToken = undefined;
      this.grossLpTokenUST = undefined;
      this.depositFeeTokenUST = undefined;
      this.netLpTokenUST = undefined;
    }
    this.refreshDataTokenToken(false);
  }

  private async refreshDataTokenToken(inputFromA: boolean) {
    const pool = this.info.poolResponses[this.vault.assetToken];
    if (this.vault.poolInfo.pairSymbol === 'UST' && inputFromA) {
      const [asset, ust] = this.findAssetBaseAndNativeToken();
      const amountToken = new BigNumber(this.depositTokenAAmtTokenToken).times(this.vault.unit);
      const amountUST = amountToken.times(ust.amount).div(asset.amount).integerValue();

      const grossLp = gt(pool.total_share, 0)
        ? BigNumber.minimum(
          amountUST.times(pool.total_share).div(ust.amount),
          amountToken.times(pool.total_share).div(asset.amount))
        : amountToken.times(amountUST).sqrt();
      if (this.vault.pairStat) {
        const depositTVL = amountUST.multipliedBy('2');
        const depositFee = this.vault.poolInfo.farm === 'Spectrum'
          ? new BigNumber('0')
          : grossLp.multipliedBy(new BigNumber('1').minus(depositTVL.dividedBy(depositTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
        this.netLpTokenUST = grossLp.minus(depositFee).toString();
        this.depositFeeTokenUST = depositFee.toString();
      }
      this.grossLpTokenUST = grossLp.toString();

      const tax = await this.terrajs.lcdClient.utils.calculateTax(Coin.fromData({ amount: amountUST.toString(), denom: 'uusd' }));
      this.depositUSTAmountTokenUST = amountUST.plus(tax.amount.toString())
        .div(CONFIG.UNIT)
        .toNumber();
    } else {
      const [assetBase, assetDenom] = this.findAssetBaseAndDenom();
      let amountBase: BigNumber;
      let amountDenom: BigNumber;
      const denomUnit = this.info.tokenInfos[assetDenom.info.token['contract_addr']].unit;
      if (inputFromA) {
        amountBase = new BigNumber(this.depositTokenAAmtTokenToken).times(this.vault.unit);
        amountDenom = amountBase.times(assetDenom.amount).div(assetBase.amount).integerValue();
        this.depositTokenBAmtTokenToken = amountDenom.div(denomUnit).toNumber();
      } else {
        amountDenom = new BigNumber(this.depositTokenBAmtTokenToken).times(denomUnit);
        amountBase = amountDenom.times(assetBase.amount).div(assetDenom.amount).integerValue();
        this.depositTokenAAmtTokenToken = amountBase.div(this.vault.unit).toNumber();
      }

      const grossLp = gt(pool.total_share, 0)
        ? BigNumber.minimum(
          amountDenom.times(pool.total_share).div(assetDenom.amount),
          amountBase.times(pool.total_share).div(assetBase.amount))
        : amountBase.times(amountDenom).sqrt();
      if (this.vault.pairStat) {
        const depositTVL = new BigNumber(this.lpBalancePipe.transform(grossLp.toString(), this.info.poolResponses, this.vault.assetToken));
        const depositFee = grossLp.multipliedBy(new BigNumber('1').minus(depositTVL.dividedBy(depositTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
        this.netLpTokenUST = grossLp.minus(depositFee).toString();
        this.depositFeeTokenUST = depositFee.toString();
      }
      this.grossLpTokenUST = grossLp.toString();

    }
  }

  private findAssetBaseAndDenom() {
    const pool = this.info.poolResponses[this.vault.assetToken];
    return pool.assets[0].info.token['contract_addr'] === this.vault.poolInfo.farmTokenContract
      ? [pool.assets[1], pool.assets[0]]
      : [pool.assets[0], pool.assets[1]];
  }

  private findAssetBaseAndNativeToken() {
    const pool = this.info.poolResponses[this.vault.assetToken];
    return pool.assets[0].info.native_token
      ? [pool.assets[1], pool.assets[0]]
      : [pool.assets[0], pool.assets[1]];
  }

  async doDeposit() {
    if (!this.depositType) {
      return;
    }
    this.$gaService.event('CLICK_DEPOSIT_LP_VAULT', `${this.depositType}, ${this.depositMode}`, this.vault.symbol + '-UST');

    let auto_compound_ratio: string;
    if (this.depositType === 'compound') {
      auto_compound_ratio = '1';
    } else if (this.depositType === 'stake') {
      auto_compound_ratio = undefined;
    } else if (this.depositType === 'mixed') {
      auto_compound_ratio = (this.auto_compound_percent_deposit / 100).toString();
    } else {
      return;
    }

    if (this.depositMode === 'tokentoken') {
      if (this.vault.poolInfo.pairSymbol === 'UST') {
        const assetAmount = times(this.depositTokenAAmtTokenToken, this.vault.unit);
        const ustAmount = times(this.depositUSTAmountTokenUST, CONFIG.UNIT);
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
        const msgs = [
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
                slippage_tolerance: CONFIG.SLIPPAGE_TOLERANCE
              }
            },
            new Coins([new Coin(Denom.USD, ustAmount)])
          )
        ];
        await this.terrajs.post(msgs);
      } else {
        const assetBaseAmount = times(this.depositTokenAAmtTokenToken, this.UNIT);
        const assetDenomAmount = times(this.depositTokenBAmtTokenToken, this.UNIT);
        const assetBase = {
          amount: assetBaseAmount,
          info: {
            token: {
              contract_addr: this.vault.assetToken,
            }
          }
        };
        const assetDenom = {
          amount: assetDenomAmount,
          info: {
            token: {
              contract_addr: this.vault.poolInfo.farmTokenContract,
            }
          }
        };

        const msgs = [
          new MsgExecuteContract(
            this.terrajs.address,
            this.vault.assetToken,
            {
              increase_allowance: {
                amount: assetBaseAmount,
                spender: this.terrajs.settings.staker,
              }
            }
          ),
          new MsgExecuteContract(
            this.terrajs.address,
            this.vault.poolInfo.farmTokenContract,
            {
              increase_allowance: {
                amount: assetDenomAmount,
                spender: this.terrajs.settings.staker,
              }
            }
          ),
          new MsgExecuteContract(
            this.terrajs.address,
            this.terrajs.settings.staker,
            {
              bond: {
                assets: [assetDenom, assetBase],
                compound_rate: auto_compound_ratio,
                contract: this.vault.poolInfo.farmContract,
                slippage_tolerance: CONFIG.SLIPPAGE_TOLERANCE
              }
            }
          )
        ];
        await this.terrajs.post(msgs);
      }

    } else if (this.depositMode === 'lp') {
      const lpAmount = times(this.depositLPAmtLP, CONFIG.UNIT);
      const farmContract = this.vault.poolInfo.farmContract;
      const msg = {
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
      };
      await this.tokenService.handle(this.vault.lpToken, msg);
    } else if (this.depositMode === 'ust') {
      const farmContract = this.vault.poolInfo.farmContract;
      const depositUST = times(this.depositUSTAmtUST, CONFIG.UNIT);
      const coin = new Coin(Denom.USD, depositUST);
      if (this.vault.poolInfo.pairSymbol === 'UST') {
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
            belief_price: this.toContractPrice(this.tokenPrice, 6, this.vault.decimals),
            max_spread: CONFIG.SLIPPAGE_TOLERANCE,
            compound_rate: auto_compound_ratio,
          }
        } as StakerExecuteMsg, new Coins([coin]));

        await this.terrajs.post(msgs);
      } else {
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
                contract_addr: this.vault.poolInfo.farmTokenContract // psi
              },
            },
            belief_price: this.tokenPrice,
            max_spread: CONFIG.SLIPPAGE_TOLERANCE,
            compound_rate: auto_compound_ratio,
            pair_asset_b: {
              token: {
                contract_addr: this.vault.assetToken // nasset
              },
            },
            belief_price_b: this.basedTokenPrice
          }
        } as StakerExecuteMsg, new Coins([coin]));

        await this.terrajs.post(msgs);
      }
    } else if (this.depositMode === 'dptoken'){
      const dpTokenAmount = times(this.depositDPTokenAmtDPToken, CONFIG.UNIT);
      const farmContract = this.vault.poolInfo.farmContract;
      const msg = {
        send: {
          amount: dpTokenAmount,
          contract: farmContract,
          msg: toBase64({
            bond: {
              asset_token: this.vault.assetToken,
              compound_rate: this.vault.poolInfo.auto_compound ? auto_compound_ratio : undefined
            }
          })
        }
      };
      await this.tokenService.handle(this.vault.assetToken, msg);
    }

    this.depositTokenAAmtTokenToken = undefined;
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

  private toContractPrice(price: string, offer_decimals: number, ask_decimals: number) {
    return offer_decimals === ask_decimals
      ? price
      : times(price, 10 ** (offer_decimals - ask_decimals));
  }

  private toUIPrice(price: string, offer_decimals: number, ask_decimals: number) {
    return offer_decimals === ask_decimals
      ? price
      : times(price, 10 ** (ask_decimals - offer_decimals));
  }

  @debounce(250)
  async withdrawAmtChanged() {
    if (this.withdrawMode !== 'ust') {
      return;
    }

    if (this.vault.poolInfo.pairSymbol === 'UST') {
      const poolResponse = this.info.poolResponses[this.vault.assetToken];
      const [tokenAsset, ustAsset] = poolResponse.assets[0].info.native_token
        ? [poolResponse.assets[1], poolResponse.assets[0]]
        : [poolResponse.assets[0], poolResponse.assets[1]];
      const ustAmt = new BigNumber(this.withdrawAmt).times(CONFIG.UNIT)
        .times(ustAsset.amount).div(poolResponse.total_share).integerValue();
      const tokenAmt = new BigNumber(this.withdrawAmt).times(CONFIG.UNIT)
        .times(tokenAsset.amount).div(poolResponse.total_share).integerValue().toString();
      const tokenPool2 = new BigNumber(tokenAsset.amount).minus(tokenAmt);
      const ustPool2 = new BigNumber(ustAsset.amount).minus(ustAmt);
      const returnAmt = ustPool2.minus(tokenPool2.times(ustPool2).div(tokenAsset.amount))
        .times(1 - +CONFIG.TERRASWAP_COMMISSION)
        .integerValue()
        .toString();
      this.withdrawTokenPrice = floor18Decimal(div(tokenAmt, returnAmt));
      this.withdrawUST = ustAmt.plus(returnAmt).toString();
      this.withdrawMinUST = ustAmt.plus(times(returnAmt, 1 - +this.SLIPPAGE)).toString();
    } else {
      const poolResponse = this.info.poolResponses[this.vault.assetToken];
      const [tokenA, tokenB] = poolResponse.assets[0].info.token['contract_addr'] === this.vault.assetToken
        ? [poolResponse.assets[1], poolResponse.assets[0]]
        : [poolResponse.assets[0], poolResponse.assets[1]];
      const tokenAAmt = new BigNumber(this.withdrawAmt).times(CONFIG.UNIT)
        .times(tokenA.amount).div(poolResponse.total_share).integerValue();
      const tokenBAmt = new BigNumber(this.withdrawAmt).times(CONFIG.UNIT)
        .times(tokenB.amount).div(poolResponse.total_share).integerValue().toString();

      const tokenAPool2 = new BigNumber(tokenA.amount).minus(tokenAAmt);
      const tokenBPool2 = new BigNumber(tokenB.amount).minus(tokenBAmt);
      const returnAmt = tokenAPool2.minus(tokenAPool2.times(tokenBPool2).div(tokenB.amount))
        .times(1 - +CONFIG.TERRASWAP_COMMISSION)
        .integerValue()
        .toString();

      this.withdrawBaseTokenPrice = floor18Decimal(div(tokenBAmt, returnAmt));
      const withdrawA = tokenAAmt.plus(returnAmt);
      const withdrawMinA = tokenAAmt.plus(times(returnAmt, 1 - +this.SLIPPAGE));

      const simulate2 = await this.terraSwap.query(this.info.pairInfos[tokenA.info.token['contract_addr']].contract_addr, {
        simulation: {
          offer_asset: {
            info: tokenA.info,
            amount: withdrawA.toString(),
          }
        }
      });
      this.withdrawTokenPrice = floor18Decimal(div(withdrawA, simulate2.return_amount));
      this.withdrawUST = simulate2.return_amount;
      this.withdrawMinUST = withdrawMinA.times(simulate2.return_amount)
        .div(withdrawA)
        .times(1 - +this.SLIPPAGE)
        .toString();
    }
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
    if (this.withdrawMode === 'tokentoken') {
      const withdrawLp = new MsgExecuteContract(
        this.terrajs.address,
        this.vault.pairInfo.liquidity_token,
        {
          send: {
            amount: times(this.withdrawAmt, CONFIG.UNIT),
            contract: this.vault.pairInfo.contract_addr,
            msg: toBase64({ withdraw_liquidity: {} }),
          }
        }
      );
      await this.terrajs.post([unbond, withdrawLp]);
    } else if (this.withdrawMode === 'lp' || this.withdrawMode === 'dptoken') {
      await this.terrajs.post([unbond]);
    } else if (this.withdrawMode === 'ust') {
      let msg: object;
      if (this.vault.poolInfo.pairSymbol === 'UST') {
        msg = {
          zap_to_unbond: {
            sell_asset: { token: { contract_addr: this.vault.poolInfo.asset_token } },
            target_asset: { native_token: { denom: Denom.USD } },
            belief_price: this.withdrawTokenPrice,
            max_spread: this.SLIPPAGE,
          },
        };
      } else {
        msg = {
          zap_to_unbond: {
            sell_asset: { token: { contract_addr: this.vault.poolInfo.farmTokenContract } },
            sell_asset_b: { token: { contract_addr: this.vault.poolInfo.asset_token } },
            target_asset: { native_token: { denom: Denom.USD } },
            belief_price: this.withdrawTokenPrice,
            belief_price_b: this.withdrawBaseTokenPrice,
            max_spread: this.SLIPPAGE,
          },
        };
      }
      const withdrawUst = new MsgExecuteContract(
        this.terrajs.address,
        this.vault.pairInfo.liquidity_token,
        {
          send: {
            amount: times(this.withdrawAmt, CONFIG.UNIT),
            contract: this.terrajs.settings.staker,
            msg: toBase64(msg),
          },
        }
      );
      await this.terrajs.post([unbond, withdrawUst]);
    }
    this.withdrawAmt = undefined;
    this.withdrawUST = undefined;
    this.withdrawMinUST = undefined;
  }

  private getWithdrawMsg(all?: boolean): MsgExecuteContract {
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

  private getMintMsg(): MsgExecuteContract {
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
  async depositLPChanged(forced: boolean, event?: any) {
    if (!forced && !event) {
      // input from from HTML has event, input from ngModel changes does not have event, trick to prevent bounce
      return;
    }
    if (!this.depositLPAmtLP) {
      this.depositLPAmtLP = undefined;
      this.depositFeeLp = undefined;
      this.netLpLp = undefined;
    }
    const grossLp = new BigNumber(this.depositLPAmtLP);
    const depositTVL = new BigNumber(this.lpBalancePipe.transform(times(this.depositLPAmtLP, CONFIG.UNIT) ?? '0', this.info.poolResponses, this.vault.assetToken));
    const depositFee = this.vault.poolInfo.farm === 'Spectrum' ? new BigNumber('0') :
      grossLp.multipliedBy(new BigNumber('1').minus(depositTVL.dividedBy(depositTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
    this.netLpLp = grossLp.minus(depositFee).toString();
    this.depositFeeLp = depositFee.toString();
  }

  setMaxDepositLP() {
    this.depositLPAmtLP = +this.info.lpTokenBalances?.[this.vault.lpToken] / CONFIG.UNIT;
    this.depositLPChanged(true);
  }

  @debounce(250)
  async depositUSTChanged(forced: boolean, event?: any) {
    if (!forced && !event) {
      // input from from HTML has event, input from ngModel changes does not have event, trick to prevent bounce
      return;
    }
    if (!this.depositUSTAmtUST) {
      this.depositUSTAmtUST = undefined;
      this.grossLpUST = undefined;
      this.depositFeeUST = undefined;
      this.netLpUST = undefined;
    }
    let grossLp: BigNumber;
    const depositTVL = new BigNumber(this.depositUSTAmtUST).times(CONFIG.UNIT);
    if (this.vault.poolInfo.pairSymbol === 'UST') {
      const [assetBase, assetNativeToken] = this.findAssetBaseAndNativeToken();
      const res = await this.staker.query({
        simulate_zap_to_bond: {
          pair_asset: assetBase.info,
          provide_asset: { amount: depositTVL.toString(), info: assetNativeToken.info } // OK now
        }
      });
      grossLp = new BigNumber(res.lp_amount).div(CONFIG.UNIT);
      this.tokenPrice = this.toUIPrice(res.belief_price, 6, this.vault.decimals);
    } else {
      const [assetBase, assetDenom] = this.findAssetBaseAndDenom();
      const res = await this.staker.query({
        simulate_zap_to_bond: {
          pair_asset_b: assetBase.info, // nLuna, nEth
          pair_asset: assetDenom.info, // Psi
          provide_asset: {
            amount: depositTVL.toString(),
            info: { native_token: { denom: Denom.USD } }
          }
        }
      });
      grossLp = new BigNumber(res.lp_amount).div(CONFIG.UNIT);
      const denomDecimals = this.info.tokenInfos[assetDenom.info.token['contract_addr']]?.decimals || 6;
      this.tokenPrice = this.toUIPrice(res.belief_price, 6, denomDecimals);
      this.basedTokenPrice = this.toUIPrice(res.belief_price_b, denomDecimals, this.vault.decimals);
    }

    const depositFee = this.vault.poolInfo.farm === 'Spectrum' ? new BigNumber('0') :
      grossLp.multipliedBy(new BigNumber('1').minus(depositTVL.dividedBy(depositTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
    this.netLpUST = grossLp.minus(depositFee).toString();
    this.grossLpUST = grossLp.toString();
    this.depositFeeUST = depositFee.toString();
  }

  setMaxDepositUST() {
    if (+this.info.userUstAmount > this.bufferUST) {
      this.depositUSTAmtUST = +floorSixDecimal(+this.info.userUstAmount - 3.5);
    }
    this.depositUSTChanged(true);
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
    const msgs = [new MsgExecuteContract(
      this.terrajs.address,
      this.vault.poolInfo.farmContract,
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

  changeDepositMode(mode: 'tokentoken' | 'lp' | 'ust') {
    setTimeout(() => this.depositMode = mode, 0);
  }

  setMaxDepositTokenBTokenToken() {
    this.tokenAToBeStatic = false;
    this.depositTokenBAmtTokenToken = +this.info.tokenBalances?.[this.vault.poolInfo.farmTokenContract] / +this.info.tokenInfos[this.vault.poolInfo.farmTokenContract].unit;
    this.depositTokenBTokenTokenChanged(true);
  }

  depositDPTokenChanged(b: boolean, $event: Event) {

  }

  setMaxDepositDPToken() {
    this.depositDPTokenAmtDPToken = +this.info.tokenBalances?.[this.vault.poolInfo.farmTokenContract] / +this.info.tokenInfos[this.vault.poolInfo.farmTokenContract].unit;
  }
}
