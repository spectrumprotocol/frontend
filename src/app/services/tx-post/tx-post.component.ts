import {HttpClient} from '@angular/common/http';
import {Component, OnInit} from '@angular/core';
import {Coin, CreateTxOptions, Fee, Msg, SignerOptions, Tx} from '@terra-money/terra.js';
import {CONFIG} from '../../consts/config';
import {TerrajsService} from '../terrajs.service';
import {GoogleAnalyticsService} from 'ngx-google-analytics';
import {MdbModalRef} from 'mdb-angular-ui-kit/modal';
import {InfoService} from '../info.service';
import BigNumber from 'bignumber.js';
import {Denom} from '../../consts/denom';

@Component({
  selector: 'app-tx-post',
  templateUrl: './tx-post.component.html',
  styleUrls: ['./tx-post.component.scss']
})
export class TxPostComponent implements OnInit {
  executed = false;
  loading = true;
  loadingMsg: string;
  msgs: Msg[];
  confirmMsg?: string;
  failed = false;
  failMsg: string;
  signMsg: Tx;
  UNIT = CONFIG.UNIT;
  txhash: string;
  link: string;
  confirmCheck = false;
  userGasLimit: string;
  gasLimit: number;
  fee: string;
  feeUST: string;
  coins: string[];
  isEnoughFee = true;
  selectedCoin = Denom.USD;
  gasBuffer = 70;
  ngx_slider_option = {
    animate: false,
    step: 10,
    tickStep: 10,
    floor: 10,
    ceil: 70,
    showTicksValues: false,
    hideLimitLabels: true,
  };

  constructor(
    private httpClient: HttpClient,
    private modalRef: MdbModalRef<TxPostComponent>,
    private terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
    private info: InfoService
  ) {
  }

  async ngOnInit() {
    try {
      if (!this.terrajs.isConnected) {
        throw new Error('please connect your wallet');
      }
      if (this.terrajs.extensionCurrentNetworkName !== this.terrajs.networkName) {
        throw new Error('Please switch to classic network in Terra Station and reconnect wallet again.');
      }

      // ensure native token balances
      if (Object.keys(this.info.tokenBalances).length === 0) {
        await this.info.refreshNativeTokens();
      }

      // load old values
      try {
        const gasSettingStr = localStorage.getItem('gasSetting');
        if (gasSettingStr) {
          const gasSetting = JSON.parse(gasSettingStr);
          if (gasSetting.selectedCoin) {
            this.selectedCoin = gasSetting.selectedCoin;
          }
          if (+gasSetting.gasBuffer) {
            this.gasBuffer = +gasSetting.gasBuffer;
          }
        }
      } catch (e) {
      }
      this.coins = Object.keys(this.info.tokenBalances)
        .filter(it => this.terrajs.lcdClient.config.gasPrices[it]);
      if (!this.coins.length) {
        this.coins.push(Denom.USD);
      }
      if (!this.coins.includes(this.selectedCoin)) {
        this.selectedCoin = this.coins[0];
      }

      // simulate
      this.loadingMsg = 'Simulating...';
      const singerOptions: SignerOptions[] = [{address: this.terrajs.address}];
      this.signMsg = await this.terrajs.lcdClient.tx.create(singerOptions, {
        msgs: this.msgs,
        feeDenoms: [Denom.USD],
      });
      this.gasLimit = this.signMsg.auth_info.fee.gas_limit;
      this.calculateFee();
      // const taxAndGas = +this.signMsg.fee.amount.get(Denom.USD).amount?.toNumber() || 0;
      // const uusdToBeSent = +this.msgs[this.msgs.length - 1]?.['coins']?.get(Denom.USD)?.amount?.toNumber() || 0;
      // const uusdAfterTx = +this.infoService.userUstAmount * CONFIG.UNIT - taxAndGas - uusdToBeSent;
      // if (taxAndGas + uusdToBeSent > +this.infoService.userUstAmount * CONFIG.UNIT){
      //   throw {
      //     message: `UST amount sent plus fee of ${+taxAndGas / CONFIG.UNIT} UST exceeds your available UST.`
      //   };
      // } else if (+uusdAfterTx < 2 * CONFIG.UNIT){
      //   this.confirmMsg = `You will have ${uusdAfterTx / CONFIG.UNIT} UST after this transaction which may not be enough for next transactions. Continue to proceed?`;
      // }

    } catch (e) {
      console.error(e);
      this.failed = true;
      this.failMsg = e.response?.data?.message || e.message || 'Error occurred';
      this.$gaService.exception('Simulating:' + (e.response?.data?.error || e.message), false);
    } finally {
      this.loading = false;
    }
    // this.signMsg = StdSignMsg.fromData({
    //   account_number: this.terrajs.address,
    //   chain_id: this.terrajs.network.chainID,
    //   fee: { gas: '500000', amount: [{ denom: Denom.USD, amount: '75000'}] },
    //   memo: '',
    //   msgs: this.msgs.map(it => it.toData()),
    //   sequence: '',
    // });
    // this.loading = false;
  }

  calculateFee() {
    this.userGasLimit = new BigNumber(this.gasLimit)
      .times(100 + this.gasBuffer).div(170)
      .integerValue(BigNumber.ROUND_UP)
      .toString();
    this.fee = new BigNumber(this.userGasLimit)
      .times(this.terrajs.lcdClient.config.gasPrices[this.selectedCoin])
      .integerValue(BigNumber.ROUND_UP)
      .toString();
    if (this.selectedCoin !== Denom.USD) {
      this.terrajs.lcdClient.market.swapRate(Coin.fromData({
        denom: this.selectedCoin,
        amount: this.fee,
      }), Denom.USD).then(it => this.feeUST = it.amount.toString());
    }
    this.isEnoughFee = +this.info.tokenBalances[this.selectedCoin] >= +this.fee;
  }

  async execute() {
    try {
      try {
        localStorage.setItem('gasSetting', JSON.stringify({
          gasBuffer: this.gasBuffer,
          selectedCoin: this.selectedCoin,
        }));
      } catch (e) {
      }
      this.loading = true;
      this.loadingMsg = 'Broadcasting...';
      const postMsg: CreateTxOptions = {
        msgs: this.msgs,
        fee: Fee.fromData({
          gas_limit: this.userGasLimit,
          amount: [{
            denom: this.selectedCoin,
            amount: this.fee,
          }],
          payer: undefined,
          granter: undefined,
        }),
        gasPrices: `${this.terrajs.lcdClient.config.gasPrices[this.selectedCoin]}${this.selectedCoin}`,
      };
      const res = await this.terrajs.walletController.post(postMsg);
      this.txhash = res.result.txhash;
      this.link = this.txhash && `https://${this.terrajs.settings.finder}/${this.terrajs.networkName}/tx/${this.txhash}`;
      if (!res.success) {
        throw res;
      }
      this.executed = true;

      this.loadingMsg = 'Waiting for result...';
      do {
        const res2 = await this.httpClient.get<any>(`${this.terrajs.settings.fcd}/v1/tx/${this.txhash}`,
          {
            observe: 'response',
          })
          .toPromise().catch(e => e);
        if (res2.ok) {
          if (res2.body?.code || res2.body?.error) {
            throw {message: 'Transaction failed', data: res2.body.code || res2.body.error};
          }
          break;
        } else {
          await new Promise(ok => setTimeout(() => ok(null), 1000));
        }
      } while (true);

    } catch (e) {
      console.error(e);
      this.$gaService.exception('Post:' + (e.data || e.message), false);
      this.failed = true;
      this.failMsg = e.message || 'Error occurred';
    } finally {
      this.loading = false;
    }
  }

  done() {
    this.modalRef.close(true);
  }

  cancel() {
    this.modalRef.close(false);
  }
}
