import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { NgForm } from '@angular/forms';
import { TerraSwapService } from '../../services/api/terraswap.service';
import { TerrajsService } from '../../services/terrajs.service';
import { CalcService } from '../../services/calc.service';
import { InfoService } from '../../services/info.service';
import { div, lte, times } from '../../libs/math';
import { CONFIG } from '../../consts/config';
import { Coin, Coins, Denom, MsgExecuteContract } from '@terra-money/terra.js';
import { debounce } from 'utils-decorators';
import { toBase64 } from '../../libs/base64';
import { fade } from '../../consts/animations';
import {GoogleAnalyticsService} from 'ngx-google-analytics';

@Component({
  selector: 'app-trade',
  templateUrl: './trade.component.html',
  styleUrls: ['./trade.component.scss'],
  animations: [fade]
})
export class TradeComponent implements OnInit, OnDestroy {

  connected: Subscription;
  @ViewChild('formBuySPEC') formBuySpec: NgForm;
  @ViewChild('formSellSPEC') formSellSpec: NgForm;
  @ViewChild('inputBuySPEC') inputBuySPEC: ElementRef;
  @ViewChild('inputBuyUST') inputBuyUST: ElementRef;
  @ViewChild('inputSellUST') inputSellUST: ElementRef;
  @ViewChild('inputSellSPEC') inputSellSPEC: ElementRef;
  @ViewChild('slippageInputForm') slippageInputForm: NgForm;

  amountBuyUST: number;
  amountBuySPEC: number;
  slippagePercentage = 0.5;
  expectedPriceBuySPEC: string;
  minimumReceivedBuySPEC: string;
  beliefPriceBuy: string;
  beliefPriceSell: string;
  amountSellSPEC: number;
  amountSellUST: number;
  minimumReceivedSellUST: string;
  expectedPriceSellSPEC: string;

  private heightChanged: Subscription;

  constructor(
    private terraSwapService: TerraSwapService,
    public terrajs: TerrajsService,
    private calcService: CalcService,
    public infoService: InfoService,
    protected $gaService: GoogleAnalyticsService
  ) { }

  ngOnDestroy(): void {
    this.heightChanged.unsubscribe();
  }

  async ngOnInit() {
    if (localStorage.getItem('slippagePercentage')) {
      this.slippagePercentage = parseFloat(localStorage.getItem('slippagePercentage'));
    }

    this.heightChanged = this.terrajs.heightChanged.subscribe(async () => {
      // await this.infoService.refreshBalance({ spec: true, ust: true });
      if (this.amountBuyUST) {
        this.refreshBuySPECInfo('UST');
      }
      if (this.amountSellUST) {
        this.refreshSellSPECInfo('SPEC');
      }
    });
  }

  setMaxBuyUST() {
    this.amountBuyUST = parseFloat(this.calcService.floorSixDecimal(this.infoService.userUstAmount));
    this.refreshBuySPECInfo('UST');
  }

  @debounce(250)
  async refreshBuySPECInfo(inputCoin: string) {
    if (inputCoin === 'UST') {
      const simulateSwapUSTtoSPEC = {
        simulation: {
          offer_asset: {
            amount: times(this.amountBuyUST, CONFIG.UNIT),
            info: {
              native_token: {
                denom: Denom.USD
              }
            }
          }
        }
      };
      if (lte(this.amountBuyUST, 0) || !this.amountBuyUST) {
        if (!this.amountBuyUST) {
          this.amountBuySPEC = null;
          this.minimumReceivedBuySPEC = null;
          this.expectedPriceBuySPEC = null;
        }
        return;
      }
      const simulateSwapUSTtoSPECResult = (await this.terraSwapService.query(this.terrajs.settings.specPool, simulateSwapUSTtoSPEC));
      this.amountBuySPEC = parseFloat(div(simulateSwapUSTtoSPECResult.return_amount, CONFIG.UNIT));
      this.beliefPriceBuy = this.calcService.floor18Decimal(times(div(this.amountBuyUST, simulateSwapUSTtoSPECResult.return_amount), CONFIG.UNIT));
      // console.log(this.beliefPriceBuy)
      this.expectedPriceBuySPEC = this.calcService.floorSixDecimal(this.beliefPriceBuy);
      this.refreshMinimumReceived();
    } else if (inputCoin === 'SPEC') {
      const reverseSimulateSwapUSTtoSPEC = {
        reverse_simulation: {
          ask_asset: {
            amount: times(this.amountBuySPEC, CONFIG.UNIT),
            info: {
              token: {
                contract_addr: this.terrajs.settings.specToken
              }
            }
          }
        }
      };
      if (lte(this.amountBuySPEC, 0) || !this.amountBuySPEC) {
        if (!this.amountBuySPEC) {
          // this.formBuySpec.form.controls.inputBuyUST.patchValue(null); // must use patchValue so that dispatchEvent works
          // (this.inputBuyUST.nativeElement as HTMLInputElement).dispatchEvent(new Event('blur'));
          this.amountBuyUST = null;
          this.minimumReceivedBuySPEC = null;
          this.expectedPriceBuySPEC = null;
        }
        return;
      }
      const reverseSimulateSwapUSTtoSPECResult = (await this.terraSwapService.query(this.terrajs.settings.specPool, reverseSimulateSwapUSTtoSPEC));
      this.amountBuyUST = parseFloat(div(reverseSimulateSwapUSTtoSPECResult.offer_amount, CONFIG.UNIT));
      this.beliefPriceBuy = this.calcService.floor18Decimal(div(div(reverseSimulateSwapUSTtoSPECResult.offer_amount, this.amountBuySPEC), CONFIG.UNIT));
      this.expectedPriceBuySPEC = this.calcService.floorSixDecimal(this.beliefPriceBuy);
      this.refreshMinimumReceived();
    }
  }

  cannotBuySPEC() {
    return this.formBuySpec?.invalid || !this.amountBuyUST || !this.amountBuySPEC || this.slippageInputForm.form.invalid;
  }

  async doBuySPEC() {
    if (this.cannotBuySPEC()) {
      return false;
    }
    this.$gaService.event('CLICK_BUY_SPEC');
    const amountUSTSubmit = times(this.amountBuyUST, CONFIG.UNIT);
    const coin = new Coin(Denom.USD, amountUSTSubmit);
    const swapBuySPECMsg = new MsgExecuteContract(this.terrajs.address, this.terrajs.settings.specPool, {
      swap: {
        belief_price: this.beliefPriceBuy,
        max_spread: div(this.slippagePercentage, 100),
        offer_asset: {
          amount: amountUSTSubmit,
          info: {
            native_token: {
              denom: Denom.USD
            }
          }
        }
      }
    }, new Coins([coin]));
    await this.terrajs.post(swapBuySPECMsg);
    this.amountBuySPEC = null;
    this.amountBuyUST = null;
    await this.infoService.refreshBalance({ spec: true, ust: true });
    this.formBuySpec.form.markAsPristine();
    this.formBuySpec.form.markAsUntouched();
  }

  setSlippage(slippage?: number) {
    if (slippage) { this.slippagePercentage = slippage; }
    localStorage.setItem('slippagePercentage', this.slippagePercentage.toString());
    this.refreshMinimumReceived();
  }

  refreshMinimumReceived() {
    this.minimumReceivedBuySPEC = (this.amountBuyUST && this.beliefPriceBuy && this.slippagePercentage) ? this.calcService.minimumReceived(times(this.amountBuyUST, CONFIG.UNIT), times(this.beliefPriceBuy, CONFIG.UNIT), div(this.slippagePercentage, 100), CONFIG.TERRASWAP_COMMISSION) : null;
    this.minimumReceivedSellUST = (this.amountSellSPEC && this.beliefPriceSell && this.slippagePercentage) ? this.calcService.minimumReceived(times(this.amountSellSPEC, CONFIG.UNIT), times(this.beliefPriceSell, CONFIG.UNIT), div(this.slippagePercentage, 100), CONFIG.TERRASWAP_COMMISSION) : null;
  }

  setMaxSellSPEC() {
    this.amountSellSPEC = +this.infoService.userSpecAmount;
    this.refreshSellSPECInfo('SPEC');
  }

  @debounce(250)
  async refreshSellSPECInfo(inputCoin: string) {
    if (inputCoin === 'SPEC') {
      const simulateSwapSPECtoUST = {
        simulation: {
          offer_asset: {
            amount: times(this.amountSellSPEC, CONFIG.UNIT),
            info: {
              token: {
                contract_addr: this.terrajs.settings.specToken
              }
            }
          }
        }
      };
      if (lte(this.amountSellSPEC, 0) || !this.amountSellSPEC) {
        if (!this.amountSellSPEC) {
          this.amountSellUST = null;
          this.minimumReceivedSellUST = null;
          this.expectedPriceSellSPEC = null;
        }
        return;
      }
      const simulateSwapUSTtoSPECResult = (await this.terraSwapService.query(this.terrajs.settings.specPool, simulateSwapSPECtoUST));
      this.amountSellUST = parseFloat(div(simulateSwapUSTtoSPECResult.return_amount, CONFIG.UNIT));
      this.beliefPriceSell = this.calcService.floor18Decimal(times(div(1, div(simulateSwapUSTtoSPECResult.return_amount, this.amountSellSPEC)), CONFIG.UNIT));
      this.expectedPriceSellSPEC = this.calcService.floor18Decimal(div(this.amountSellUST, this.amountSellSPEC));
      this.refreshMinimumReceived();
    }
    else if (inputCoin === 'UST') {
      const reverseSimulateSwapSPECtoUST = {
        reverse_simulation: {
          ask_asset: {
            amount: times(this.amountSellUST, CONFIG.UNIT),
            info: {
              native_token: {
                denom: Denom.USD
              }
            }
          }
        }
      };
      if (lte(this.amountSellUST, 0) || !this.amountSellUST) {
        if (!this.amountSellUST) {
          this.amountSellSPEC = null;
          this.minimumReceivedSellUST = null;
          this.expectedPriceSellSPEC = null;
        }
        return;
      }
      const reverseSimulateSwapSPECtoUSTResult = (await this.terraSwapService.query(this.terrajs.settings.specPool, reverseSimulateSwapSPECtoUST));
      this.amountSellSPEC = parseFloat(div(reverseSimulateSwapSPECtoUSTResult.offer_amount, CONFIG.UNIT));
      this.beliefPriceSell = this.calcService.floor18Decimal(div(div(1, div(this.amountSellUST, reverseSimulateSwapSPECtoUSTResult.offer_amount)), CONFIG.UNIT));
      // console.log(this.beliefPriceSell)
      this.expectedPriceSellSPEC = this.calcService.floor18Decimal(div(this.amountSellUST, this.amountSellSPEC));
      this.refreshMinimumReceived();
      this.formSellSpec.form.markAsPristine();
      this.formSellSpec.form.markAsUntouched();
    }
  }

  cannotSellSPEC() {
    return this.formSellSpec?.invalid || !this.amountSellUST || !this.amountSellSPEC || this.slippageInputForm.form.invalid;
  }

  async doSellSPEC() {
    if (this.cannotSellSPEC()) {
      return false;
    }
    this.$gaService.event('CLICK_SELL_SPEC');
    const amountSPECSubmit = times(this.amountSellSPEC, CONFIG.UNIT);
    const sendSellSPECMsg = new MsgExecuteContract(this.terrajs.address, this.terrajs.settings.specToken, {
      send: {
        amount: amountSPECSubmit,
        contract: this.terrajs.settings.specPool,
        msg: toBase64({
          swap: {
            belief_price: this.beliefPriceSell,
            max_spread: div(this.slippagePercentage, 100)
          }
        })
      }
    });
    await this.terrajs.post(sendSellSPECMsg);
    this.amountSellSPEC = null;
    this.amountSellUST = null;
    await this.infoService.refreshBalance({ spec: true, ust: true });
  }

}
