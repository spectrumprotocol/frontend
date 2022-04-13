import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NgForm} from '@angular/forms';
import {Coin, Coins, MsgExecuteContract} from '@terra-money/terra.js';
import {fade} from '../../../../consts/animations';
import {CONFIG} from '../../../../consts/config';
import {toBase64} from '../../../../libs/base64';
import {div, floor, floor18Decimal, floorSixDecimal, gt, times} from '../../../../libs/math';
import {TerrajsService} from '../../../../services/terrajs.service';
import {Vault} from '../../vault.component';
import {GoogleAnalyticsService} from 'ngx-google-analytics';
import {InfoService} from '../../../../services/info.service';
import {Subscription} from 'rxjs';
import BigNumber from 'bignumber.js';
import {debounce} from 'utils-decorators';
import {ChangeContext, Options as NgxSliderOptions} from '@angular-slider/ngx-slider';
import {LpBalancePipe} from '../../../../pipes/lp-balance.pipe';
import {TokenService} from '../../../../services/api/token.service';
import {TerraSwapService} from '../../../../services/api/terraswap.service';
import {Denom} from '../../../../consts/denom';
import {StakerService} from '../../../../services/api/staker.service';
import {ExecuteMsg as StakerExecuteMsg} from '../../../../services/api/staker/execute_msg';
import {MdbModalRef} from 'mdb-angular-ui-kit/modal';
import {TerraSwapRouterService} from '../../../../services/api/terraswap-router.service';
import {StakerAstroportService} from '../../../../services/api/staker-astroport.service';
import {AstroportService} from '../../../../services/api/astroport.service';
import {SimulateZapToBondResponse} from '../../../../services/api/staker/simulate_zap_to_bond_response';
import {SimulationResponse} from '../../../../services/api/terraswap_pair/simulation_response';
import {PercentPipe} from '@angular/common';
import {FARM_TYPE_SINGLE_TOKEN} from 'src/app/services/farm_info/farm-info.service';
import {AstroportRouterService} from '../../../../services/api/astroport-router.service';
import {RewardInfoPipe} from 'src/app/pipes/reward-info.pipe';
import {LpSplitPipe} from 'src/app/pipes/lp-split.pipe';
import {SwapOperation} from '../../../../services/api/staker/query_msg';
import {StakerCw20HookMsg} from '../../../../services/api/staker/cw20_hook_msg';

const DEPOSIT_FEE = '0.001';
export type DEPOSIT_WITHDRAW_MODE_ENUM = 'tokentoken' | 'lp' | 'ust' | 'single_token' | 'ust_single_token';

@Component({
  selector: 'app-vault-dialog',
  templateUrl: './vault-dialog.component.html',
  styleUrls: ['./vault-dialog.component.scss'],
  animations: [fade],
  providers: [LpBalancePipe, PercentPipe, RewardInfoPipe, LpSplitPipe]
})
export class VaultDialogComponent implements OnInit, OnDestroy {
  vault: Vault;
  @ViewChild('formDeposit') formDeposit: NgForm;
  @ViewChild('formWithdraw') formWithdraw: NgForm;

  UNIT: number = CONFIG.UNIT;
  SLIPPAGE = CONFIG.SLIPPAGE_TOLERANCE;
  FARM_TYPE_SINGLE_TOKEN = FARM_TYPE_SINGLE_TOKEN;
  // naming convention: actual input field, input mode
  depositTokenAAmtTokenToken: number;
  depositUSTAmountTokenUST: number;
  depositLPAmtLP: number;
  depositUSTAmtUST: number;
  depositTokenBAmtTokenToken: number;
  depositTokenAmtSingleToken: number;
  depositUSTAmtSingleToken: number;
  tokenAToBeStatic = true;
  lpBalanceInfo: string;
  depositType: 'compound' | 'stake' | 'mixed';
  depositMode: DEPOSIT_WITHDRAW_MODE_ENUM;
  withdrawMode: DEPOSIT_WITHDRAW_MODE_ENUM;
  withdrawAmt: number;
  withdrawUST: string;
  withdrawMinUST: string;
  withdrawTokenPrice: string;
  withdrawBaseTokenPrice: string;
  grossLpTokenToken: string;
  depositFeeTokenToken: string;
  netLpTokenToken: string;
  depositFeeLp: string;
  netLpLp: string;
  grossLpUST: string;
  depositFeeUST: string;
  netLpUST: string;
  tokenPrice: string;
  tokenPriceNonUSTDenomInUST: string;
  basedTokenPrice: string;
  ustForSwapSingleToken: string;
  ustForDepositbDP: string;
  tokenFromSwapSingleToken: string;
  tokenFromDepositbDP: string;
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
  private heightChanged: Subscription;

  constructor(
    public modalRef: MdbModalRef<VaultDialogComponent>,
    public terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
    public info: InfoService,
    private tokenService: TokenService,
    private staker: StakerService,
    private stakerAstroport: StakerAstroportService,
    private terraSwap: TerraSwapService,
    private terraSwapRouter: TerraSwapRouterService,
    private astroport: AstroportService,
    private percentPipe: PercentPipe,
    private astroportRouter: AstroportRouterService,
    private rewardInfoPipe: RewardInfoPipe,
    private lpSplitPipe: LpSplitPipe,
  ) {
  }

  get ASTRO_KEY() {
    return `Astroport|${this.terrajs.settings.astroToken}|${Denom.USD}`;
  }

  get SPEC_KEY() {
    return `Terraswap|${this.terrajs.settings.specToken}|${Denom.USD}`;
  }

  get NASSET_PSI_KEY() {
    return `${this.vault.poolInfo.dex}|${this.vault.poolInfo.baseTokenContract}|${this.terrajs.settings.nexusToken}`;
  }

  get PSI_UST_KEY() {
    return `Astroport|${this.terrajs.settings.nexusToken}|${Denom.USD}`;
  }

  get LUNA_UST_KEY() {
    return `Astroport|${Denom.LUNA}|${Denom.USD}`;
  }

  get STLUNA_LUNA_KEY() {
    return `Astroport|${this.terrajs.settings.stlunaToken}|${Denom.LUNA}`;
  }

  get keySingleToken_Denom() {
    return `${this.vault.poolInfo.dex}|${this.vault.poolInfo.baseTokenContract}|${this.vault.poolInfo.denomTokenContract}`;
  }

  ngOnInit() {
    if (this.vault.poolInfo.farmType === 'LP') {
      this.depositMode = 'tokentoken';
      this.withdrawMode = 'tokentoken';
    } else if (FARM_TYPE_SINGLE_TOKEN.has(this.vault.poolInfo.farmType)) {
      this.depositMode = 'single_token';
      this.withdrawMode = 'single_token';
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
        } else if (FARM_TYPE_SINGLE_TOKEN.has(this.vault.poolInfo.farmType)) {
          const tasks: Promise<any>[] = [];
          tasks.push(this.info.refreshTokenBalance(this.vault.poolInfo.baseTokenContract)); // AssetToken-Farm
          tasks.push(this.info.refreshTokenBalance(this.vault.poolInfo.denomTokenContract)); // Farm-UST
          await Promise.all(tasks);
          if (this.depositUSTAmtSingleToken) {
            this.depositUSTForSingleToken(true);
          }
        }
        this.refreshLpBalanceInfo();
      }
    });
    this.refreshData();
  }

  getAPRAPYTooltipHTML() {
    let html = '<div class="apyapr-tooltip">';
    let totalApr = 0;
    if (this.vault.pairStat?.poolApr > 0) {
      html += `${this.vault.rewardSymbol} APR ${this.percentPipe.transform(this.vault.pairStat.poolApr)} <br>`;
      // html += `${this.vault.rewardSymbol} APY ${this.percentPipe.transform((this.vault.pairStat.poolApr / 365 + 1) ** 365 - 1)} <br>`;
      totalApr += this.vault.pairStat.poolApr;
    }
    if (this.vault.pairStat?.poolAstroApr > 0) {
      html += `ASTRO APR ${this.percentPipe.transform(this.vault.pairStat.poolAstroApr)} <br>`;
      // html += `ASTRO APY ${this.percentPipe.transform((this.vault.pairStat.poolAstroApr / 365 + 1) ** 365 - 1)} <br>`;
      totalApr += this.vault.pairStat.poolAstroApr;
    }
    if (this.vault.pairStat?.poolApr > 0 && this.vault.pairStat?.poolAstroApr > 0) {
      html += `Rewards APR ${this.percentPipe.transform(totalApr)} <br>`;
    }
    if (this.vault.poolInfo?.tradeApr > 0 && this.vault.poolInfo.farmType === 'LP') {
      html += `Trade APR ${this.percentPipe.transform(this.vault.poolInfo.tradeApr)} <br>`;
      // html += `Trade APY ${this.percentPipe.transform((this.vault.poolInfo.tradeApr / 365 + 1) ** 365 - 1)} <br>`;
    }
    if (this.vault.poolInfo.dex === 'Astroport' && this.vault.poolInfo.farmType === 'LP') {
      html += `(APR from Astroport data) <br>`;
    }
    if (this.vault.pairStat?.poolApy > 0) {
      html += `Auto-compound APY ${this.percentPipe.transform(this.vault.pairStat?.poolApy)} <br>`;
    }
    if (this.vault.farmApy > 0 && this.vault.poolInfo.auto_stake) {
      html += `Auto-stake APY ${this.percentPipe.transform(+this.vault.farmApy)} <br>`;
    }
    if (this.vault.specApy > 0) {
      html += `SPEC APR ${this.percentPipe.transform(this.vault.specApy)} <br><br>`;
    }
    html += '</div>';
    return html;
  }

  async refreshData() {
    if (this.info.rewardInfos[this.vault.poolInfo.key]) {
      this.auto_compound_percent_reallocate = Math.round(+this.info.rewardInfos[this.vault.poolInfo.key]?.auto_bond_amount / +this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount * 100);
    }
    if (this.vault.poolInfo.forceDepositType) {
      this.depositType = this.vault.poolInfo.forceDepositType as any;
    }
    this.refreshLpBalanceInfo();
  }

  async refreshLpBalanceInfo() {
    this.lpBalanceInfo = '';
    if (this.vault.poolInfo.key !== this.SPEC_KEY) {
      this.lpBalanceInfo += `${this.rewardInfoPipe.transform(this.info.rewardInfos[this.vault.poolInfo.key])} `;
    }
    if (this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount) {
      const lpSplitText = this.lpSplitPipe.transform(+this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount / this.UNIT,
        this.info.poolResponses[this.vault.poolInfo.key], this.vault.baseSymbol,
        this.vault.denomSymbol, this.vault.baseDecimals, '1.0-2', this.vault.denomDecimals, '1.0-2'
      );
      this.lpBalanceInfo += `(${lpSplitText})`;
    }
  }

  ngOnDestroy() {
    this.heightChanged.unsubscribe();
  }

  setMaxDepositTokenATokenToken() {
    this.tokenAToBeStatic = true;
    this.depositTokenAAmtTokenToken = +this.info.tokenBalances?.[this.vault.poolInfo.baseTokenContract] / this.vault.baseUnit;
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
      this.grossLpTokenToken = undefined;
      this.depositFeeTokenToken = undefined;
      this.netLpTokenToken = undefined;
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
      this.grossLpTokenToken = undefined;
      this.depositFeeTokenToken = undefined;
      this.netLpTokenToken = undefined;
    }
    this.refreshDataTokenToken(false);
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

    const staker = this.vault.poolInfo.dex === 'Terraswap' ? this.terrajs.settings.staker : this.terrajs.settings.stakerAstroport;

    if (this.depositMode === 'tokentoken') {
      const assetBaseAmount = times(this.depositTokenAAmtTokenToken, this.vault.baseUnit);
      const assetDenomAmount = this.vault.poolInfo.denomTokenContract === Denom.USD
        ? times(this.depositUSTAmountTokenUST, CONFIG.UNIT)
        : times(this.depositTokenBAmtTokenToken, this.vault.denomUnit);
      const assetBase = {
        amount: assetBaseAmount,
        info: this.vault.baseAssetInfo
      };
      const assetDenom = {
        amount: assetDenomAmount,
        info: this.vault.denomAssetInfo
      };

      const msgs: MsgExecuteContract[] = [];
      const coins: Coin[] = [];

      if (this.vault.poolInfo.baseTokenContract.startsWith('u')) {
        coins.push(new Coin(this.vault.poolInfo.baseTokenContract, assetBaseAmount));
      } else {
        msgs.push(new MsgExecuteContract(
          this.terrajs.address,
          this.vault.poolInfo.baseTokenContract,
          {
            increase_allowance: {
              amount: assetBaseAmount,
              spender: staker,
            }
          }
        ));
      }
      if (this.vault.poolInfo.denomTokenContract.startsWith('u')) {
        coins.push(new Coin(this.vault.poolInfo.denomTokenContract, assetDenomAmount));
      } else {
        msgs.push(new MsgExecuteContract(
          this.terrajs.address,
          this.vault.poolInfo.denomTokenContract,
          {
            increase_allowance: {
              amount: assetDenomAmount,
              spender: staker,
            }
          }
        ));
      }

      msgs.push(new MsgExecuteContract(
        this.terrajs.address,
        staker,
        {
          bond: {
            assets: this.vault.poolInfo.denomTokenContract.startsWith('u')
              ? [assetBase, assetDenom]
              : [assetDenom, assetBase],
            compound_rate: auto_compound_ratio,
            contract: this.vault.poolInfo.farmContract,
            slippage_tolerance: CONFIG.SLIPPAGE_TOLERANCE
          }
        },
        coins
      ));
      await this.terrajs.post(msgs);
    } else if (this.depositMode === 'lp') {
      const lpAmount = times(this.depositLPAmtLP, CONFIG.UNIT);
      const farmContract = this.vault.poolInfo.farmContract;
      const msg = {
        send: {
          amount: lpAmount,
          contract: farmContract,
          msg: toBase64({
            bond: {
              asset_token: this.vault.poolInfo.baseTokenContract,
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
      if (this.vault.poolInfo.denomTokenContract === Denom.USD) {
        const msgs = new MsgExecuteContract(this.terrajs.address, staker, {
          zap_to_bond: {
            asset_token: this.vault.poolInfo.asset_token,
            contract: farmContract,
            provide_asset: {
              info: {native_token: {denom: Denom.USD}},
              amount: depositUST
            },
            pair_asset: this.vault.baseAssetInfo,
            belief_price: this.toContractPrice(this.tokenPrice, 6, this.vault.baseDecimals),
            max_spread: CONFIG.SLIPPAGE_TOLERANCE,
            compound_rate: auto_compound_ratio,
          }
        } as StakerExecuteMsg, new Coins([coin]));

        await this.terrajs.post(msgs);
      } else {
        const msgs = new MsgExecuteContract(this.terrajs.address, staker, {
          zap_to_bond: {
            asset_token: this.vault.poolInfo.asset_token,
            contract: farmContract,
            provide_asset: {
              info: {
                native_token: {
                  denom: Denom.USD
                }
              },
              amount: depositUST
            },
            pair_asset: this.vault.denomAssetInfo,
            belief_price: this.tokenPrice,
            max_spread: CONFIG.SLIPPAGE_TOLERANCE,
            compound_rate: auto_compound_ratio,
            pair_asset_b: {
              token: {
                contract_addr: this.vault.poolInfo.baseTokenContract // nasset
              },
            },
            belief_price_b: this.basedTokenPrice,
            skip_stable_swap: true, //this.vault.pairInfo?.['stable'] ? true : false, // TODO
            swap_hints: this.getSwapHints()
          }
        } as StakerExecuteMsg, new Coins([coin]));
        await this.terrajs.post(msgs);
      }
    } else if (this.depositMode === 'single_token') {
      const dpTokenAmount = times(this.depositTokenAmtSingleToken, CONFIG.UNIT);
      const farmContract = this.vault.poolInfo.farmContract;
      const msg = {
        send: {
          amount: dpTokenAmount,
          contract: farmContract,
          msg: toBase64({
            bond: {
              asset_token: this.vault.poolInfo.asset_token, // not needed for contract, but for tx-history
              compound_rate: this.vault.poolInfo.auto_compound ? auto_compound_ratio : undefined
            }
          })
        }
      };
      await this.tokenService.handle(this.vault.poolInfo.baseTokenContract, msg);
    } else if (this.depositMode === 'ust_single_token') {
      const msgs: MsgExecuteContract[] = [];
      if (+this.ustForSwapSingleToken) {
        msgs.push(new MsgExecuteContract(this.terrajs.address, this.terrajs.settings.stakerSingleAsset, {
          zap_to_bond: {
            contract: this.vault.poolInfo.farmContract,
            provide_asset: {
              info: {
                native_token: {
                  denom: Denom.USD
                }
              },
              amount: this.ustForSwapSingleToken
            },
            swap_operations: [
              {
                pair_contract: this.info.pairInfos[this.vault.poolInfo.rewardKey].contract_addr,
                asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.rewardTokenContract,
                  },
                },
                belief_price: this.basedTokenPrice,
              },
              {
                pair_contract: this.info.pairInfos[this.keySingleToken_Denom].contract_addr,
                asset_info: {
                  token: {
                    contract_addr: this.vault.poolInfo.baseTokenContract,
                  },
                },
                belief_price: this.tokenPrice,
              },
            ],
            max_spread: CONFIG.SLIPPAGE_TOLERANCE,
            compound_rate: this.vault.poolInfo.auto_compound ? auto_compound_ratio : undefined
          }
        }, [new Coin(Denom.USD, this.ustForSwapSingleToken)]));
      }

      if (+this.ustForDepositbDP) {
        const farmInfo = this.info.farmInfos.find(it => it.farmContract === this.vault.poolInfo.farmContract);
        const liquidPool = farmInfo.pylonLiquidInfo;
        msgs.push(new MsgExecuteContract(
          this.terrajs.address,
          liquidPool.dpPool,
          {deposit: {}},
          [new Coin(Denom.USD, this.ustForDepositbDP)]));
        msgs.push(new MsgExecuteContract(
          this.terrajs.address,
          liquidPool.dpToken,
          {
            send: {
              amount: this.tokenFromDepositbDP,
              contract: liquidPool.bdpPool,
              msg: toBase64({deposit: {}}),
            }
          }
        ));
        msgs.push(new MsgExecuteContract(
          this.terrajs.address,
          liquidPool.bdpToken,
          {
            send: {
              amount: this.tokenFromDepositbDP,
              contract: this.vault.poolInfo.farmContract,
              msg: toBase64({
                bond: {
                  asset_token: this.vault.poolInfo.asset_token, // not needed for contract, but for tx-history
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

    this.netLpTokenToken = undefined;
    this.depositFeeTokenToken = undefined;
    this.netLpTokenToken = undefined;

    this.depositFeeLp = undefined;
    this.netLpLp = undefined;

    this.grossLpUST = undefined;
    this.depositFeeUST = undefined;
    this.netLpUST = undefined;

    this.depositTokenAmtSingleToken = undefined;
    this.depositFeeLp = undefined;
    this.netLpLp = undefined;
    this.depositUSTAmtSingleToken = undefined;

    this.depositType = undefined;
  }

  @debounce(250)
  async withdrawAmtChanged() {
    if (!this.withdrawAmt || (this.withdrawMode !== 'ust' && this.withdrawMode !== 'ust_single_token')) {
      return;
    }
    let commission = 0;
    const pairInfo = this.info.pairInfos[this.vault.poolInfo.key];
    if (this.vault.poolInfo.dex === 'Astroport') {
      if (pairInfo?.pair_type?.['stable']) {
        commission = +CONFIG.ASTROPORT_STABLE_COMMISSION_TOTAL;
      } else if (pairInfo?.pair_type?.['xyk']) {
        commission = +CONFIG.ASTROPORT_XYK_COMMISSION_TOTAL;
      }
    } else if (this.vault.poolInfo.dex === 'Terraswap') {
      commission = +CONFIG.TERRASWAP_COMMISSION;
    }
    if (this.FARM_TYPE_SINGLE_TOKEN.has(this.vault.poolInfo.farmType)) {
      const offer_amount = new BigNumber(this.withdrawAmt).times(CONFIG.UNIT).toString();
      let simulateSwapOperationRes;
      if (this.vault.poolInfo.dex === 'Terraswap') {
        simulateSwapOperationRes = await this.terraSwapRouter.query({
          simulate_swap_operations: {
            offer_amount,
            operations: [
              {
                terra_swap: {
                  offer_asset_info: {
                    token: {
                      contract_addr: this.vault.poolInfo.baseTokenContract
                    }
                  },
                  ask_asset_info: {
                    token: {
                      contract_addr: this.vault.poolInfo.denomTokenContract
                    }
                  }
                }
              },
              {
                terra_swap: {
                  offer_asset_info: {
                    token: {
                      contract_addr: this.vault.poolInfo.denomTokenContract
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
      } else if (this.vault.poolInfo.dex === 'Astroport') {
        simulateSwapOperationRes = await this.astroportRouter.query({
          simulate_swap_operations: {
            offer_amount,
            operations: [
              {
                astro_swap: {
                  offer_asset_info: {
                    token: {
                      contract_addr: this.vault.poolInfo.baseTokenContract
                    }
                  },
                  ask_asset_info: {
                    token: {
                      contract_addr: this.vault.poolInfo.denomTokenContract
                    }
                  }
                }
              },
              {
                astro_swap: {
                  offer_asset_info: {
                    token: {
                      contract_addr: this.vault.poolInfo.denomTokenContract
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
      }

      this.withdrawUST = simulateSwapOperationRes.amount;
      this.withdrawMinUST = new BigNumber(this.withdrawUST)
        .times(1 - +this.SLIPPAGE)
        .integerValue(BigNumber.ROUND_DOWN)
        .toString();
    } else if (this.vault.poolInfo.denomTokenContract === Denom.USD) {
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
        .times(1 - +commission)
        .integerValue()
        .toString();
      this.withdrawTokenPrice = floor18Decimal(div(tokenAmt, returnAmt));
      this.withdrawUST = ustAmt.plus(returnAmt).toString();
      this.withdrawMinUST = ustAmt.plus(times(returnAmt, 1 - +this.SLIPPAGE)).toString();
    } else if (this.vault.poolInfo.farmContract === this.terrajs.settings.astroportStlunaLdoFarm) {
      // LDO -> stLuna
      const poolResponseStlunaLdo = this.info.poolResponses[this.vault.poolInfo.key];
      const [stlunaAsset, ldoAsset] = poolResponseStlunaLdo.assets[0].info.token?.['contract_addr'] === this.terrajs.settings.stlunaToken
        ? [poolResponseStlunaLdo.assets[1], poolResponseStlunaLdo.assets[0]]
        : [poolResponseStlunaLdo.assets[0], poolResponseStlunaLdo.assets[1]];
      const ldoAmtToBeWithdrawn = new BigNumber(this.withdrawAmt).times(CONFIG.UNIT)
        .times(ldoAsset.amount).div(poolResponseStlunaLdo.total_share).integerValue();
      const stlunaAmtToBeWithdrawn = new BigNumber(this.withdrawAmt).times(CONFIG.UNIT)
        .times(stlunaAsset.amount).div(poolResponseStlunaLdo.total_share).integerValue();
      const ldoPoolAmtAfterWithdrawn = new BigNumber(ldoAsset.amount).minus(ldoAmtToBeWithdrawn);
      const stlunaPoolAmtAfterWithdrawn = new BigNumber(stlunaAsset.amount).minus(stlunaAmtToBeWithdrawn);
      const stLunaReturnAmtFromSellingLdo = ldoPoolAmtAfterWithdrawn.minus(stlunaPoolAmtAfterWithdrawn.times(ldoPoolAmtAfterWithdrawn).div(stlunaAsset.amount))
        .times(1 - +commission)
        .integerValue()
        .toString(); // this is correct
      // stluna 0.2 ldo 5.6 -> 0.202337
      // 9301843706035 3364052865 560156893 202583 9301283549142 3363850282 201963
      console.log(stlunaAsset.amount,
        ldoAsset.amount,
        stlunaAmtToBeWithdrawn.toNumber(),
        ldoAmtToBeWithdrawn.toNumber(),
        stlunaPoolAmtAfterWithdrawn.toNumber(),
        ldoPoolAmtAfterWithdrawn.toNumber(),
        +stLunaReturnAmtFromSellingLdo);
      // stLuna -> Luna -> UST
    } else {
      const poolResponse = this.info.poolResponses[this.vault.poolInfo.key];
      const asset0Token: string = poolResponse.assets[0].info.token
        ? poolResponse.assets[0].info.token?.['contract_addr']
        : poolResponse.assets[0].info.native_token?.['denom'];
      const [tokenA, tokenB] = asset0Token === this.vault.poolInfo.baseTokenContract
        ? [poolResponse.assets[1], poolResponse.assets[0]]
        : [poolResponse.assets[0], poolResponse.assets[1]];
      const tokenAAmt = new BigNumber(this.withdrawAmt).times(CONFIG.UNIT)
        .times(tokenA.amount).div(poolResponse.total_share).integerValue();
      const tokenBAmt = new BigNumber(this.withdrawAmt).times(CONFIG.UNIT)
        .times(tokenB.amount).div(poolResponse.total_share).integerValue().toString();

      let returnAmt: string;
      // stable swap use simulation
      if (pairInfo.pair_type?.['stable']) {
        const simulation_msg = {
          simulation: {
            offer_asset: {
              info: tokenB.info,
              amount: tokenBAmt,
            }
          }
        };
        const simulate = await this.astroport.query(pairInfo.contract_addr, simulation_msg);
        returnAmt = simulate.return_amount;
      } else {
        // calculate return amount after withdraw
        const tokenAPool2 = new BigNumber(tokenA.amount).minus(tokenAAmt);
        const tokenBPool2 = new BigNumber(tokenB.amount).minus(tokenBAmt);
        returnAmt = tokenAPool2.minus(tokenAPool2.times(tokenBPool2).div(tokenB.amount))
          .times(1 - +commission)
          .integerValue()
          .toString();
      }

      this.withdrawBaseTokenPrice = floor18Decimal(div(tokenBAmt, returnAmt));
      const withdrawA = tokenAAmt.plus(returnAmt);
      const withdrawMinA = tokenAAmt.plus(times(returnAmt, 1 - +this.SLIPPAGE));

      const simulation2_msg = {
        simulation: {
          offer_asset: {
            info: tokenA.info,
            amount: withdrawA.toString(),
          }
        }
      };
      let simulate2: SimulationResponse;
      const tokenAContractAddrOrDenom = tokenA.info.token?.['contract_addr'] || tokenA.info.native_token?.['denom'];
      if (this.vault.poolInfo.dex === 'Astroport') {
        simulate2 = await this.astroport.query(this.info.pairInfos[`${this.vault.poolInfo.dex}|${tokenAContractAddrOrDenom}|${Denom.USD}`].contract_addr, simulation2_msg);
      } else if (this.vault.poolInfo.dex === 'Terraswap') {
        simulate2 = await this.terraSwap.query(this.info.pairInfos[`${this.vault.poolInfo.dex}|${tokenAContractAddrOrDenom}|${Denom.USD}`].contract_addr, simulation2_msg);
      }
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
    const staker = this.vault.poolInfo.dex === 'Terraswap' ? this.terrajs.settings.staker : this.terrajs.settings.stakerAstroport;
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
            msg: toBase64({withdraw_liquidity: {}}),
          }
        }
      );
      await this.terrajs.post([unbond, withdrawLp]);
    } else if (this.withdrawMode === 'lp' || this.withdrawMode === 'single_token') {
      await this.terrajs.post([unbond]);
    } else if (this.withdrawMode === 'ust') {
      let msg: object;
      if (this.vault.poolInfo.denomTokenContract === Denom.USD) {
        msg = {
          zap_to_unbond: {
            sell_asset: this.vault.baseAssetInfo,
            target_asset: {native_token: {denom: Denom.USD}},
            belief_price: this.withdrawTokenPrice,
            max_spread: this.SLIPPAGE,
          },
        } as StakerCw20HookMsg;
      } else {
        msg = {
          zap_to_unbond: {
            sell_asset: this.vault.denomAssetInfo,
            sell_asset_b: this.vault.baseAssetInfo,
            target_asset: {native_token: {denom: Denom.USD}},
            belief_price: this.withdrawTokenPrice,
            belief_price_b: this.withdrawBaseTokenPrice,
            max_spread: this.SLIPPAGE,
            swap_hints: this.getSwapHints(true)
          },
        } as StakerCw20HookMsg;
      }
      const withdrawUst = new MsgExecuteContract(
        this.terrajs.address,
        this.vault.pairInfo.liquidity_token,
        {
          send: {
            amount: times(this.withdrawAmt, CONFIG.UNIT),
            contract: staker,
            msg: toBase64(msg),
          },
        }
      );
      await this.terrajs.post([unbond, withdrawUst]);
    } else if (this.withdrawMode === 'ust_single_token') {
      let msg;
      if (this.vault.poolInfo.dex === 'Terraswap') {
        msg = {
          execute_swap_operations: {
            minimum_receive: this.withdrawMinUST,
            operations: [
              {
                terra_swap: {
                  offer_asset_info: {
                    token: {
                      contract_addr: this.vault.poolInfo.baseTokenContract
                    }
                  },
                  ask_asset_info: {
                    token: {
                      contract_addr: this.vault.poolInfo.denomTokenContract
                    }
                  }
                }
              },
              {
                terra_swap: {
                  offer_asset_info: {
                    token: {
                      contract_addr: this.vault.poolInfo.denomTokenContract
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
      } else if (this.vault.poolInfo.dex === 'Astroport') {
        msg = {
          execute_swap_operations: {
            minimum_receive: this.withdrawMinUST,
            operations: [
              {
                astro_swap: {
                  offer_asset_info: {
                    token: {
                      contract_addr: this.vault.poolInfo.baseTokenContract
                    }
                  },
                  ask_asset_info: {
                    token: {
                      contract_addr: this.vault.poolInfo.denomTokenContract
                    }
                  }
                }
              },
              {
                astro_swap: {
                  offer_asset_info: {
                    token: {
                      contract_addr: this.vault.poolInfo.denomTokenContract
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
      }
      const routerContract = this.vault.poolInfo.dex === 'Terraswap' ? this.terrajs.settings.terraSwapRouter : this.terrajs.settings.astroportRouter;
      const withdrawUst = new MsgExecuteContract(
        this.terrajs.address,
        this.vault.poolInfo.baseTokenContract,
        {
          send: {
            amount: times(this.withdrawAmt, CONFIG.UNIT),
            contract: routerContract,
            msg: toBase64(msg),
          },
        }
      );

      if (this.vault.poolInfo.farmType === 'PYLON_LIQUID') {
        const lossPercent = (((+this.withdrawAmt * CONFIG.UNIT - +this.withdrawUST) / (+this.withdrawAmt * CONFIG.UNIT)) * 100).toFixed(2);
        const confirmMsg = +lossPercent > 0 ? `I confirm to sell ${this.vault.baseSymbol} at about ${lossPercent}% discount.` : undefined;
        await this.terrajs.post([unbond, withdrawUst], confirmMsg);
      } else if (this.vault.poolInfo.farmType === 'NASSET') {
        await this.terrajs.post([unbond, withdrawUst]);
      }

    }
    this.withdrawAmt = undefined;
    this.withdrawUST = undefined;
    this.withdrawMinUST = undefined;
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

  autoCompoundChanged(changeContext?: ChangeContext) {
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
    const depositFee = this.vault.poolInfo.farm === 'Spectrum'
      ? new BigNumber('0')
      : grossLp.multipliedBy(DEPOSIT_FEE);
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
      this.tokenPriceNonUSTDenomInUST = undefined;
    }
    let grossLp: BigNumber;
    const depositTVL = new BigNumber(this.depositUSTAmtUST).times(CONFIG.UNIT);
    if (this.vault.poolInfo.denomTokenContract === Denom.USD) {
      // LUNA-UST also ok
      const [assetBase, assetNativeToken] = this.findAssetBaseAndDenom();
      const simulate_zap_to_bond_msg = {
        simulate_zap_to_bond: {
          pair_asset: assetBase.info,
          provide_asset: {amount: depositTVL.toString(), info: assetNativeToken.info}
        }
      };
      let res: SimulateZapToBondResponse;
      if (this.vault.poolInfo.dex === 'Terraswap') {
        res = await this.staker.query(simulate_zap_to_bond_msg);
      } else if (this.vault.poolInfo.dex === 'Astroport') {
        res = await this.stakerAstroport.query(simulate_zap_to_bond_msg);
      }
      grossLp = new BigNumber(res.lp_amount).div(CONFIG.UNIT);
      this.tokenPrice = this.toUIPrice(res.belief_price, 6, this.vault.baseDecimals);
    } else {
      const [assetBase, assetDenom] = this.findAssetBaseAndDenom();
      const simulate_zap_to_bond_msg = {
        simulate_zap_to_bond: {
          pair_asset_b: assetBase.info,
          pair_asset: assetDenom.info,
          provide_asset: {
            amount: depositTVL.toString(),
            info: {native_token: {denom: Denom.USD}}
          },
          swap_hints: this.getSwapHints()
        }
      };
      let res: SimulateZapToBondResponse;
      if (this.vault.poolInfo.dex === 'Terraswap') {
        res = await this.staker.query(simulate_zap_to_bond_msg);
      } else if (this.vault.poolInfo.dex === 'Astroport') {
        res = await this.stakerAstroport.query(simulate_zap_to_bond_msg);
      }
      grossLp = new BigNumber(res.lp_amount).div(CONFIG.UNIT);
      this.tokenPrice = this.toUIPrice(res.belief_price, 6, this.vault.denomDecimals);
      this.basedTokenPrice = this.toUIPrice(res.belief_price_b, this.vault.baseDecimals, this.vault.baseDecimals);
      this.tokenPriceNonUSTDenomInUST = floor18Decimal(times(this.tokenPrice, this.basedTokenPrice));
    }

    const depositFee = this.vault.poolInfo.farm === 'Spectrum'
      ? new BigNumber('0')
      : grossLp.multipliedBy(DEPOSIT_FEE);
    this.netLpUST = grossLp.minus(depositFee).toString();
    this.grossLpUST = grossLp.toString();
    this.depositFeeUST = depositFee.toString();
  }

  setMaxDepositUST() {
    if (+this.info.userUstAmount > this.bufferUST) {
      this.depositUSTAmtUST = +floorSixDecimal(+this.info.userUstAmount - this.bufferUST);
    }
    this.depositUSTChanged(true);
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
    this.depositTokenBAmtTokenToken = +this.info.tokenBalances?.[this.vault.poolInfo.denomTokenContract] / +this.vault.denomUnit;
    this.depositTokenBTokenTokenChanged(true);
  }

  @debounce(250)
  depositSingleTokenChanged(forced: boolean, event?: any) {
    if (!forced && !event) {
      // input from from HTML has event, input from ngModel changes does not have event, trick to prevent bounce
      return;
    }
    if (!this.depositTokenAmtSingleToken) {
      this.depositTokenAmtSingleToken = undefined;
      this.depositFeeLp = undefined;
      this.netLpLp = undefined;
    }

    const grossLp = new BigNumber(this.depositTokenAmtSingleToken);
    const depositFee = grossLp.multipliedBy(DEPOSIT_FEE);
    this.netLpLp = grossLp.minus(depositFee).toString();
    this.depositFeeLp = depositFee.toString();
  }

  setMaxDepositSingleToken() {
    this.depositTokenAmtSingleToken = +this.info.tokenBalances?.[this.vault.poolInfo.baseTokenContract] / +this.vault.baseUnit;
    this.depositSingleTokenChanged(true);
  }

  setMaxDepositUSTForSingleToken() {
    if (+this.info.userUstAmount > this.bufferUST) {
      this.depositUSTAmtSingleToken = +floorSixDecimal(+this.info.userUstAmount - this.bufferUST);
    }
    this.depositUSTForSingleToken(true);
  }

  @debounce(250)
  async depositUSTForSingleToken(forced: boolean, event?: any) {
    if (!forced && !event) {
      // input from from HTML has event, input from ngModel changes does not have event, trick to prevent bounce
      return;
    }
    if (!this.depositUSTAmtSingleToken) {
      this.depositTokenAmtSingleToken = undefined;
      this.ustForDepositbDP = undefined;
      this.ustForSwapSingleToken = undefined;
      this.tokenPrice = undefined;
      this.tokenPriceNonUSTDenomInUST = undefined;
      this.basedTokenPrice = undefined;
      this.tokenFromSwapSingleToken = undefined;
      this.tokenFromDepositbDP = undefined;
      this.grossLpUST = undefined;
      this.depositFeeUST = undefined;
      this.netLpUST = undefined;
    }

    if (this.vault.poolInfo.farmType === 'PYLON_LIQUID') {
      const depositTVL = new BigNumber(this.depositUSTAmtSingleToken).times(CONFIG.UNIT);
      const poolResponse1 = this.info.poolResponses[this.vault.poolInfo.rewardKey]; // Farm-UST
      const [ustPool, farmPool1] = poolResponse1.assets[0].info.native_token
        ? [poolResponse1.assets[0].amount, poolResponse1.assets[1].amount]
        : [poolResponse1.assets[1].amount, poolResponse1.assets[0].amount];
      const poolResponse2 = this.info.poolResponses[this.keySingleToken_Denom]; // bDP-Farm
      const [farmPool2, bDpPool] = poolResponse2.assets[1].info.token['contract_addr'] === this.vault.poolInfo.baseTokenContract
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
          .multipliedBy(0.985)  // buffer for tax
          .integerValue();
        if (maxUst.lt(500_000000)) {
          maxUst = new BigNumber(0);
        }
        if (maxUst.isGreaterThanOrEqualTo(depositTVL)) {
          this.ustForSwapSingleToken = depositTVL.toString();
          this.ustForDepositbDP = '0';
        } else {
          const maxUstBuffer = maxUst;
          this.ustForSwapSingleToken = maxUstBuffer.toString();
          this.ustForDepositbDP = depositTVL.minus(maxUstBuffer).toString();
        }
      } else {
        this.ustForSwapSingleToken = '0';
        this.ustForDepositbDP = depositTVL.toString();
      }
    }

    if (this.vault.poolInfo.farmType === 'NASSET') {
      this.ustForSwapSingleToken = times(this.depositUSTAmtSingleToken, CONFIG.UNIT);
    }

    const dexService = this.vault.poolInfo.dex === 'Terraswap' ? this.terraSwap : this.astroport;
    if (+this.ustForSwapSingleToken) {
      const simulate1 = await dexService.query(this.info.pairInfos[this.vault.poolInfo.rewardKey].contract_addr, {
        simulation: {
          offer_asset: {
            info: {native_token: {denom: Denom.USD}},
            amount: this.ustForSwapSingleToken,
          }
        }
      });
      this.basedTokenPrice = floor18Decimal(div(this.ustForSwapSingleToken, simulate1.return_amount));
      const simulate2 = await dexService.query(this.info.pairInfos[this.keySingleToken_Denom].contract_addr, {
        simulation: {
          offer_asset: {
            info: {token: {contract_addr: this.vault.poolInfo.rewardTokenContract}},
            amount: simulate1.return_amount,
          }
        }
      });
      this.tokenPrice = floor18Decimal(div(simulate1.return_amount, simulate2.return_amount));
      this.tokenPriceNonUSTDenomInUST = floor18Decimal(times(this.tokenPrice, this.basedTokenPrice));
      this.tokenFromSwapSingleToken = simulate2.return_amount;
    } else {
      this.tokenFromSwapSingleToken = undefined;
    }
    if (+this.ustForDepositbDP) {
      this.tokenFromDepositbDP = await this.terrajs.deductTax(Denom.USD, this.ustForDepositbDP);
    } else {
      this.tokenFromDepositbDP = undefined;
    }
    const grossLp = new BigNumber(this.tokenFromSwapSingleToken || 0).plus(this.tokenFromDepositbDP || 0);
    const depositFee = grossLp.multipliedBy(DEPOSIT_FEE);
    this.grossLpUST = grossLp.toString();
    this.netLpUST = grossLp.minus(depositFee).toString();
    this.depositFeeUST = depositFee.toString();
  }

  private async refreshDataTokenToken(inputFromA: boolean) {
    const pool = this.info.poolResponses[this.vault.poolInfo.key];
    const [assetBase, assetDenom] = this.findAssetBaseAndDenom();
    let amountBase: BigNumber;
    let amountDenom: BigNumber;
    const denomUnit = this.vault.denomUnit;
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
      const depositFee = this.vault.poolInfo.farm === 'Spectrum'
        ? new BigNumber('0')
        : grossLp.multipliedBy(DEPOSIT_FEE);
      this.netLpTokenToken = grossLp.minus(depositFee).toString();
      this.depositFeeTokenToken = depositFee.toString();
    }
    this.grossLpTokenToken = grossLp.toString();

    if (this.vault.poolInfo.denomTokenContract === Denom.USD) {
      const tax = await this.terrajs.lcdClient.utils.calculateTax(Coin.fromData({
        amount: amountDenom.toString(),
        denom: 'uusd'
      }));
      this.depositUSTAmountTokenUST = amountDenom.plus(tax.amount.toString())
        .div(CONFIG.UNIT)
        .toNumber();
    }
  }

  private findAssetBaseAndDenom() {
    const poolResponse = this.info.poolResponses[this.vault.poolInfo.key];
    const asset0Token: string = poolResponse.assets[0].info.token
      ? poolResponse.assets[0].info.token?.['contract_addr']
      : poolResponse.assets[0].info.native_token?.['denom'];
    return asset0Token === this.vault.poolInfo.baseTokenContract
      ? [poolResponse.assets[0], poolResponse.assets[1]]
      : [poolResponse.assets[1], poolResponse.assets[0]];
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

  private calcNewStakeOrCompoundAmount(mode: string) {
    if (+this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount < 10) {
      return '0';
    } else if (mode === 'stake') {
      return times(this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount, (100 - this.auto_compound_percent_reallocate) / 100);
    } else if (mode === 'compound') {
      return times(this.info.rewardInfos[this.vault.poolInfo.key]?.bond_amount, (this.auto_compound_percent_reallocate) / 100);
    }
  }

  private getSwapHints(reverse?: boolean): [] {
    let swap_hints;
    if (this.vault.poolInfo.farmContract === this.terrajs.settings.astroportStlunaLdoFarm) {
      const luna_ust_pairInfo = this.info.pairInfos[this.LUNA_UST_KEY];
      const stluna_luna_pairInfo = this.info.pairInfos[this.STLUNA_LUNA_KEY];
      swap_hints = [{
        asset_info: {
          native_token: {
            denom: Denom.USD
          }
        },
        belief_price: null,
        pair_contract: luna_ust_pairInfo.contract_addr,
      } as SwapOperation, {
        asset_info: {
          native_token: {
            denom: Denom.LUNA
          }
        },
        belief_price: null,
        pair_contract: stluna_luna_pairInfo.contract_addr,
      } as SwapOperation];
      if (reverse) {
        swap_hints.reverse();
      }
    }
    return swap_hints;
  }
}
