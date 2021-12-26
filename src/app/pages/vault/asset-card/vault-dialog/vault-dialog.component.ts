import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
import { MdbModalRef } from 'mdb-angular-ui-kit/modal';
import { TerraSwapRouterService } from '../../../../services/api/terraswap-router.service';

const DEPOSIT_FEE = '0.001';
export type DEPOSIT_WITHDRAW_MODE_ENUM = 'tokentoken' | 'lp' | 'ust' | 'bdp' | 'ust_bdp';

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

  // naming convention: actual input field, input mode
  depositTokenAAmtTokenToken: number;
  depositUSTAmountTokenUST: number;
  depositLPAmtLP: number;
  depositUSTAmtUST: number;
  depositTokenBAmtTokenToken: number;
  depositbDPTokenAmtbDPToken: number;
  depositUSTAmtbDPToken: number;

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

  ustForSwapDP: string;
  ustForDepositDP: string;
  lpFromSwapDP: string;
  lpFromDepositDP: string;

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

  constructor(
    public modalRef: MdbModalRef<VaultDialogComponent>,
    public terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
    public info: InfoService,
    private lpBalancePipe: LpBalancePipe,
    private tokenService: TokenService,
    private staker: StakerService,
    private terraSwap: TerraSwapService,
    private terraSwapRouter: TerraSwapRouterService
  ) { }

  ngOnInit() {
    if (this.vault.poolInfo.farmType === 'LP') {
      this.depositMode = 'tokentoken';
      this.withdrawMode = 'tokentoken';
    } else if (this.vault.poolInfo.farmType === 'PYLON_LIQUID') {
      this.depositMode = 'bdp';
      this.withdrawMode = 'bdp';
    }
    this.heightChanged = this.terrajs.heightChanged.subscribe(async () => {
      if (this.terrajs.isConnected) {
        if (this.vault.poolInfo.farmType === 'LP') {
          const tasks: Promise<any>[] = [];
          tasks.push(this.info.refreshPoolResponse(this.vault.poolInfo.key));
          await Promise.all(tasks);
          if (this.depositTokenAAmtTokenToken && this.tokenAToBeStatic) {
            this.depositTokenATokenTokenChanged(true);
          } else if (this.depositTokenBAmtTokenToken && !this.tokenAToBeStatic) {
            this.depositTokenBTokenTokenChanged(true);
          }
          if (this.withdrawAmt) {
            this.withdrawAmtChanged();
          }
        } else if (this.vault.poolInfo.farmType === 'PYLON_LIQUID') {
          const tasks: Promise<any>[] = [];
          tasks.push(this.info.refreshTokenBalance(this.vault.poolInfo.baseTokenContractOrNative)); // AssetToken-Farm
          tasks.push(this.info.refreshTokenBalance(this.vault.poolInfo.denomTokenContractOrNative)); // Farm-UST
          await Promise.all(tasks);
          if (this.depositUSTAmtbDPToken) {
            this.depositUSTForBDPChanged(true);
          }
        }
      }
    });
    this.refreshData();
  }

  async refreshData() {
    if (this.info.rewardInfos[this.vault.poolInfo.key]) {
      this.auto_compound_percent_reallocate = Math.round(+this.info.rewardInfos[this.vault.poolInfo.key]?.auto_bond_amount / +this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount * 100);
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
    this.depositTokenAAmtTokenToken = +this.info.tokenBalances?.[this.vault.poolInfo.baseTokenContractOrNative] / this.vault.baseUnit;
    this.depositTokenATokenTokenChanged(true);
  }

  setMaxWithdrawAmount() {
    const rewardInfo = this.info.rewardInfos?.[this.vault.poolInfo.key];
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
    const pool = this.info.poolResponses[this.vault.poolInfo.key];
    if (this.vault.denomSymbol === 'UST' && inputFromA) {
      const [asset, ust] = this.findAssetBaseAndNativeToken();
      const amountToken = new BigNumber(this.depositTokenAAmtTokenToken).times(this.vault.baseUnit);
      const amountUST = amountToken.times(ust.amount).div(asset.amount).integerValue();

      const grossLp = gt(pool.total_share, 0)
        ? BigNumber.minimum(
          amountUST.times(pool.total_share).div(ust.amount),
          amountToken.times(pool.total_share).div(asset.amount))
        : amountToken.times(amountUST).sqrt();
      if (this.vault.pairStat) {
        const depositTVL = amountUST.multipliedBy('2');
        const myTVL = depositTVL.plus(this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount || '0');
        const depositFee = this.vault.poolInfo.farm === 'Spectrum'
          ? new BigNumber('0')
          : grossLp.multipliedBy(new BigNumber('1').minus(myTVL.dividedBy(myTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
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
        amountBase = new BigNumber(this.depositTokenAAmtTokenToken).times(this.vault.baseUnit);
        amountDenom = amountBase.times(assetDenom.amount).div(assetBase.amount).integerValue();
        this.depositTokenBAmtTokenToken = amountDenom.div(denomUnit).toNumber();
      } else {
        amountDenom = new BigNumber(this.depositTokenBAmtTokenToken).times(denomUnit);
        amountBase = amountDenom.times(assetBase.amount).div(assetDenom.amount).integerValue();
        this.depositTokenAAmtTokenToken = amountBase.div(this.vault.baseUnit).toNumber();
      }

      const grossLp = gt(pool.total_share, 0)
        ? BigNumber.minimum(
          amountDenom.times(pool.total_share).div(assetDenom.amount),
          amountBase.times(pool.total_share).div(assetBase.amount))
        : amountBase.times(amountDenom).sqrt();
      if (this.vault.pairStat) {
        const depositTVL = new BigNumber(this.lpBalancePipe.transform(grossLp.toString(), this.info.poolResponses, this.vault.poolInfo.key));
        const myTVL = depositTVL.plus(this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount || '0');
        const depositFee = grossLp.multipliedBy(new BigNumber('1').minus(myTVL.dividedBy(myTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
        this.netLpTokenUST = grossLp.minus(depositFee).toString();
        this.depositFeeTokenUST = depositFee.toString();
      }
      this.grossLpTokenUST = grossLp.toString();

    }
  }

  private findAssetBaseAndDenom() {
    const pool = this.info.poolResponses[this.vault.poolInfo.key];
    return pool.assets[0].info.token['contract_addr'] === this.vault.poolInfo.baseTokenContractOrNative
      ? [pool.assets[0], pool.assets[1]]
      : [pool.assets[1], pool.assets[0]];
  }

  private findAssetBaseAndNativeToken() {
    const pool = this.info.poolResponses[this.vault.poolInfo.key];
    return pool.assets[0].info.native_token
      ? [pool.assets[1], pool.assets[0]]
      : [pool.assets[0], pool.assets[1]];
  }

  async doDeposit() {
    if (!this.depositType) {
      return;
    }
    this.$gaService.event('CLICK_DEPOSIT_LP_VAULT', `${this.depositType}, ${this.depositMode}`, this.vault.baseSymbol + '-UST');

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
        const assetAmount = times(this.depositTokenAAmtTokenToken, this.vault.baseUnit);
        const ustAmount = times(this.depositUSTAmountTokenUST, CONFIG.UNIT);
        const asset = {
          amount: assetAmount,
          info: {
            token: {
              contract_addr: this.vault.poolInfo.baseTokenContractOrNative,
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
        const pool = this.info.poolResponses[this.vault.poolInfo.key];
        const assets = pool.assets[0].info.native_token ? [ust, asset] : [asset, ust];
        const msgs = [
          new MsgExecuteContract(
            this.terrajs.address,
            this.vault.poolInfo.baseTokenContractOrNative,
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
              contract_addr: this.vault.poolInfo.baseTokenContractOrNative,
            }
          }
        };
        const assetDenom = {
          amount: assetDenomAmount,
          info: {
            token: {
              contract_addr: this.vault.poolInfo.rewardTokenContract,
            }
          }
        };

        const msgs = [
          new MsgExecuteContract(
            this.terrajs.address,
            this.vault.poolInfo.baseTokenContractOrNative,
            {
              increase_allowance: {
                amount: assetBaseAmount,
                spender: this.terrajs.settings.staker,
              }
            }
          ),
          new MsgExecuteContract(
            this.terrajs.address,
            this.vault.poolInfo.rewardTokenContract,
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
              asset_token: this.vault.poolInfo.baseTokenContractOrNative,
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
                contract_addr: this.vault.poolInfo.baseTokenContractOrNative
              },
            },
            belief_price: this.toContractPrice(this.tokenPrice, 6, this.vault.baseDecimals),
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
                contract_addr: this.vault.poolInfo.denomTokenContractOrNative // psi
              },
            },
            belief_price: this.tokenPrice,
            max_spread: CONFIG.SLIPPAGE_TOLERANCE,
            compound_rate: auto_compound_ratio,
            pair_asset_b: {
              token: {
                contract_addr: this.vault.poolInfo.baseTokenContractOrNative // nasset
              },
            },
            belief_price_b: this.basedTokenPrice
          }
        } as StakerExecuteMsg, new Coins([coin]));

        await this.terrajs.post(msgs);
      }
    } else if (this.depositMode === 'bdp') {
      const dpTokenAmount = times(this.depositbDPTokenAmtbDPToken, CONFIG.UNIT);
      const farmContract = this.vault.poolInfo.farmContract;
      const msg = {
        send: {
          amount: dpTokenAmount,
          contract: farmContract,
          msg: toBase64({
            bond: {
              asset_token: this.vault.poolInfo.baseTokenContractOrNative,
              compound_rate: this.vault.poolInfo.auto_compound ? auto_compound_ratio : undefined
            }
          })
        }
      };
      await this.tokenService.handle(this.vault.poolInfo.baseTokenContractOrNative, msg);
    } else if (this.depositMode === 'ust_bdp') {
      const msgs: MsgExecuteContract[] = [];
      if (+this.ustForSwapDP) {
        msgs.push(new MsgExecuteContract(this.terrajs.address, this.terrajs.settings.stakerSingleAsset, {
          zap_to_bond: {
            contract: this.vault.poolInfo.farmContract,
            provide_asset: {
              info: {
                native_token: {
                  denom: Denom.USD
                }
              },
              amount: this.ustForSwapDP
            },
            swap_operations: [
              {
                pair_contract: this.info.pairInfos[this.vault.poolInfo.key].contract_addr,
                asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.farmTokenContract,
                  },
                },
                belief_price: this.basedTokenPrice,
              },
              {
                pair_contract: this.info.pairInfos[this.vault.poolInfo.asset_token].contract_addr,
                asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.asset_token,
                  },
                },
                belief_price: this.tokenPrice,
              },
            ],
            max_spread: CONFIG.SLIPPAGE_TOLERANCE,
            compound_rate: this.vault.poolInfo.auto_compound ? auto_compound_ratio : undefined
          }
        }, [new Coin(Denom.USD, this.ustForSwapDP)]));
      }

      if (+this.ustForDepositDP) {
        const farmInfo = this.info.farmInfos.find(it => it.farmContract === this.vault.poolInfo.farmContract);
        const liquidPool = farmInfo.pylonLiquidInfo;
        msgs.push(new MsgExecuteContract(
          this.terrajs.address,
          liquidPool.dpPool,
          { deposit: {} },
          [new Coin(Denom.USD, this.ustForDepositDP)]));
        msgs.push(new MsgExecuteContract(
          this.terrajs.address,
          liquidPool.dpToken,
          {
            send: {
              amount: this.lpFromDepositDP,
              contract: liquidPool.bdpPool,
              msg: toBase64({ deposit: {} }),
            }
          }
        ));
        msgs.push(new MsgExecuteContract(
          this.terrajs.address,
          liquidPool.bdpToken,
          {
            send: {
              amount: this.lpFromDepositDP,
              contract: this.vault.poolInfo.farmContract,
              msg: toBase64({
                bond: {
                  asset_token: this.vault.poolInfo.baseTokenContractOrNative,
                  compound_rate: this.vault.poolInfo.auto_compound ? auto_compound_ratio : undefined
                }
              })
            }
          }
        ));
      }

      await this.terrajs.post(msgs);
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

    this.depositbDPTokenAmtbDPToken = undefined;
    this.depositFeeLp = undefined;
    this.netLpLp = undefined;
    this.depositUSTAmtbDPToken = undefined;

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
    if (this.withdrawMode !== 'ust' && this.withdrawMode !== 'ust_bdp') {
      return;
    }

    if (this.vault.poolInfo.farmType === 'PYLON_LIQUID') {
      const offer_amount = new BigNumber(this.withdrawAmt).times(CONFIG.UNIT).toString();
      const simulateSwapOperationRes = await this.terraSwapRouter.query({
        simulate_swap_operations: {
          offer_amount,
          operations: [
            {
              terra_swap: {
                offer_asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.baseTokenContractOrNative
                  }
                },
                ask_asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.denomTokenContractOrNative
                  }
                }
              }
            },
            {
              terra_swap: {
                offer_asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.denomTokenContractOrNative
                  }
                },
                ask_asset_info: {
                  native_token: {
                    denom: Denom.USD
                  }
                }
              }
            }
          ]
        }
      });
      this.withdrawUST = simulateSwapOperationRes.amount;
      this.withdrawMinUST = new BigNumber(this.withdrawUST)
        .times(1 - +this.SLIPPAGE)
        .integerValue(BigNumber.ROUND_DOWN)
        .toString();
    } else if (this.vault.poolInfo.pairSymbol === 'UST') {
      const poolResponse = this.info.poolResponses[this.vault.poolInfo.key];
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
      const poolResponse = this.info.poolResponses[this.vault.poolInfo.key];
      const [tokenA, tokenB] = poolResponse.assets[0].info.token['contract_addr'] === this.vault.poolInfo.baseTokenContractOrNative
        ? [poolResponse.assets[0], poolResponse.assets[1]]
        : [poolResponse.assets[1], poolResponse.assets[0]];
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
    this.$gaService.event('CLICK_WITHDRAW_LP_VAULT', this.vault.poolInfo.farm.toUpperCase(), this.vault.baseSymbol + '-UST');
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
    } else if (this.withdrawMode === 'lp' || this.withdrawMode === 'bdp') {
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
            sell_asset: { token: { contract_addr: this.vault.poolInfo.rewardTokenContract } },
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
    } else if (this.withdrawMode === 'ust_bdp') {
      const msg = {
        execute_swap_operations: {
          minimum_receive: this.withdrawMinUST,
          operations: [
            {
              terra_swap: {
                offer_asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.baseTokenContractOrNative
                  }
                },
                ask_asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.denomTokenContractOrNative
                  }
                }
              }
            },
            {
              terra_swap: {
                offer_asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.denomTokenContractOrNative
                  }
                },
                ask_asset_info: {
                  native_token: {
                    denom: Denom.USD
                  }
                }
              }
            }
          ]
        }
      };
      const withdrawUst = new MsgExecuteContract(
        this.terrajs.address,
        this.vault.poolInfo.baseTokenContractOrNative,
        {
          send: {
            amount: times(this.withdrawAmt, CONFIG.UNIT),
            contract: this.terrajs.settings.terraSwapRouter,
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
    this.$gaService.event('CLICK_CLAIM_REWARD', this.vault.poolInfo.farm, this.vault.baseSymbol + '-UST');
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
    const depositTVL = new BigNumber(this.lpBalancePipe.transform(times(this.depositLPAmtLP, CONFIG.UNIT) ?? '0', this.info.poolResponses, this.vault.poolInfo.key));
    const myTVL = depositTVL.plus(this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount || '0');
    const depositFee = this.vault.poolInfo.farm === 'Spectrum' ? new BigNumber('0') :
      grossLp.multipliedBy(new BigNumber('1').minus(myTVL.dividedBy(myTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
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
    if (this.vault.poolInfo.denomTokenContractOrNative === Denom.USD) {
      const [assetBase, assetNativeToken] = this.findAssetBaseAndNativeToken();
      const res = await this.staker.query({
        simulate_zap_to_bond: {
          pair_asset: assetBase.info,
          provide_asset: { amount: depositTVL.toString(), info: assetNativeToken.info } // OK now
        }
      });
      grossLp = new BigNumber(res.lp_amount).div(CONFIG.UNIT);
      this.tokenPrice = this.toUIPrice(res.belief_price, 6, this.vault.baseDecimals);
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
      this.basedTokenPrice = this.toUIPrice(res.belief_price_b, denomDecimals, this.vault.baseDecimals);
    }

    const myTVL = depositTVL.plus(this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount || '0');
    const depositFee = this.vault.poolInfo.farm === 'Spectrum' ? new BigNumber('0') :
      grossLp.multipliedBy(new BigNumber('1').minus(myTVL.dividedBy(myTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
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
    if (+this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount < 10) {
      return '0';
    } else if (mode === 'stake') {
      return times(this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount, (100 - this.auto_compound_percent_reallocate) / 100);
    } else if (mode === 'compound') {
      return times(this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount, (this.auto_compound_percent_reallocate) / 100);
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

  changeDepositMode(mode: DEPOSIT_WITHDRAW_MODE_ENUM) {
    setTimeout(() => this.depositMode = mode, 0);
  }

  setMaxDepositTokenBTokenToken() {
    this.tokenAToBeStatic = false;
    this.depositTokenBAmtTokenToken = +this.info.tokenBalances?.[this.vault.poolInfo.denomTokenContractOrNative] / +this.vault.denomUnit;
    this.depositTokenBTokenTokenChanged(true);
  }

  @debounce(250)
  depositbDPTokenChanged(forced: boolean, event?: any) {
    if (!forced && !event) {
      // input from from HTML has event, input from ngModel changes does not have event, trick to prevent bounce
      return;
    }
    if (!this.depositbDPTokenAmtbDPToken) {
      this.depositbDPTokenAmtbDPToken = undefined;
      this.depositFeeLp = undefined;
      this.netLpLp = undefined;
    }

    const grossLp = new BigNumber(this.depositbDPTokenAmtbDPToken);
    const depositTVL = new BigNumber(this.depositbDPTokenAmtbDPToken).times(CONFIG.UNIT);
    const myTVL = depositTVL.plus(this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount || '0');
    const depositFee = grossLp.multipliedBy(new BigNumber('1').minus(myTVL.dividedBy(myTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
    this.netLpLp = grossLp.minus(depositFee).toString();
    this.depositFeeLp = depositFee.toString();
  }

  setMaxDepositbDPToken() {
    this.depositbDPTokenAmtbDPToken = +this.info.tokenBalances?.[this.vault.poolInfo.baseTokenContractOrNative] / +this.vault.baseUnit;
  }

  setMaxDepositUSTForBDP() {
    if (+this.info.userUstAmount > this.bufferUST) {
      this.depositUSTAmtbDPToken = +floorSixDecimal(+this.info.userUstAmount - 3.5);
    }
    this.depositUSTForBDPChanged(true);
  }

  @debounce(250)
  async depositUSTForBDPChanged(forced: boolean, event?: any) {
    if (!forced && !event) {
      // input from from HTML has event, input from ngModel changes does not have event, trick to prevent bounce
      return;
    }
    if (!this.depositUSTAmtbDPToken) {
      this.depositbDPTokenAmtbDPToken = undefined;
      this.ustForDepositDP = undefined;
      this.ustForSwapDP = undefined;
      this.tokenPrice = undefined;
      this.basedTokenPrice = undefined;
      this.lpFromSwapDP = undefined;
      this.lpFromDepositDP = undefined;
      this.grossLpUST = undefined;
      this.depositFeeUST = undefined;
      this.netLpUST = undefined;
    }

    const depositTVL = new BigNumber(this.depositUSTAmtbDPToken).times(CONFIG.UNIT);
    // TODO recheck
    const poolResponse1 = this.info.poolResponses[this.vault.poolInfo.dex + '|' + this.vault.poolInfo.denomTokenContractOrNative + '|' + Denom.USD]; // Farm-UST
    const [ustPool, farmPool1] = poolResponse1.assets[0].info.native_token
      ? [poolResponse1.assets[0].amount, poolResponse1.assets[1].amount]
      : [poolResponse1.assets[1].amount, poolResponse1.assets[0].amount];
    const poolResponse2 = this.info.poolResponses[this.vault.poolInfo.key]; // bDP-Farm
    const [farmPool2, bDpPool] = poolResponse2.assets[1].info.token['contract_addr'] === this.vault.poolInfo.baseTokenContractOrNative
      ? [poolResponse2.assets[0].amount, poolResponse2.assets[1].amount]
      : [poolResponse2.assets[1].amount, poolResponse2.assets[0].amount];

    const farmPool1AfterCom = new BigNumber(farmPool1).times(1 - +CONFIG.TERRASWAP_COMMISSION);
    const bDpPoolAfterCom = new BigNumber(bDpPool).times(1 - +CONFIG.TERRASWAP_COMMISSION);
    const outPool = farmPool1AfterCom.times(bDpPoolAfterCom);
    const inPool = new BigNumber(ustPool).times(farmPool2);
    if (outPool.isGreaterThan(inPool)) {
      const maxFarmAmount = outPool.minus(inPool).div(bDpPoolAfterCom.plus(ustPool));
      let maxUst = bDpPoolAfterCom.times(maxFarmAmount)
        .div(maxFarmAmount.plus(farmPool2))
        .multipliedBy(0.99)  // buffer for tax
        .integerValue();
      if (maxUst.lt(500_000000)) {
        maxUst = new BigNumber(0);
      }
      if (maxUst.isGreaterThanOrEqualTo(depositTVL)) {
        this.ustForSwapDP = depositTVL.toString();
        this.ustForDepositDP = '0';
      } else {
        const maxUstBuffer = maxUst;
        this.ustForSwapDP = maxUstBuffer.toString();
        this.ustForDepositDP = depositTVL.minus(maxUstBuffer).toString();
      }
    } else {
      this.ustForSwapDP = '0';
      this.ustForDepositDP = depositTVL.toString();
    }

    if (+this.ustForSwapDP) {
      this.tokenPrice = floor18Decimal(div(farmPool2, bDpPool));
      this.basedTokenPrice = floor18Decimal(div(ustPool, farmPool1));
      const simulateSwapOperationRes = await this.terraSwapRouter.query({
        simulate_swap_operations: {
          offer_amount: this.ustForSwapDP.toString(),
          operations: [
            {
              terra_swap: {
                offer_asset_info: {
                  native_token: {
                    denom: Denom.USD
                  }
                },
                ask_asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.denomTokenContractOrNative
                  }
                }
              }
            },
            {
              terra_swap: {
                offer_asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.denomTokenContractOrNative
                  }
                },
                ask_asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.baseTokenContractOrNative
                  }
                }
              }
            }
          ]
        }
      });
      this.lpFromSwapDP = simulateSwapOperationRes.amount;
    } else {
      this.lpFromSwapDP = undefined;
    }
    if (+this.ustForDepositDP) {
      this.lpFromDepositDP = await this.terrajs.deductTax(Denom.USD, this.ustForDepositDP);
    } else {
      this.lpFromDepositDP = undefined;
    }
    const myTVL = depositTVL.plus(this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount || '0');
    const grossLp = new BigNumber(this.lpFromSwapDP || 0).plus(this.lpFromDepositDP || 0);
    const depositFee = grossLp.multipliedBy(new BigNumber('1').minus(myTVL.dividedBy(myTVL.plus(this.vault.pairStat.tvl))).multipliedBy(DEPOSIT_FEE));
    this.grossLpUST = grossLp.toString();
    this.netLpUST = grossLp.minus(depositFee).toString();
    this.depositFeeUST = depositFee.toString();
  }
}
