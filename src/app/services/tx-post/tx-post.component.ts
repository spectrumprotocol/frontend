import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import {Msg, SignerOptions} from '@terra-money/terra.js';
import { CONFIG } from '../../consts/config';
import { TerrajsService } from '../terrajs.service';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import {MdbModalRef} from 'mdb-angular-ui-kit/modal';
import {InfoService} from '../info.service';

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
  signMsg: any;
  UNIT = CONFIG.UNIT;
  txhash: string;
  link: string;
  confirmCheck = false;
  fee: number;

  constructor(
    private httpClient: HttpClient,
    private modalRef: MdbModalRef<TxPostComponent>,
    private terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService,
    private infoService: InfoService
  ) { }

  async ngOnInit() {
    try {
      if (!this.terrajs.isConnected) {
        throw new Error('please connect your wallet');
      }
      this.loadingMsg = 'Simulating...';
      const singerOptions: SignerOptions[] = [{address: this.terrajs.address}];
      this.signMsg = await this.terrajs.lcdClient.tx.create(singerOptions, {
        msgs: this.msgs,
        feeDenoms: ['uusd']
      });
      this.fee = this.signMsg.auth_info.fee.amount.get('uusd').amount?.toNumber();
      // const taxAndGas = +this.signMsg.fee.amount.get('uusd').amount?.toNumber() || 0;
      // const uusdToBeSent = +this.msgs[this.msgs.length - 1]?.['coins']?.get('uusd')?.amount?.toNumber() || 0;
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
      this.failMsg = e.response?.data?.error || e.message || 'Error occurred';
      this.$gaService.exception('Simulating:' + (e.response?.data?.error || e.message), false);
    } finally {
      this.loading = false;
    }
    // this.signMsg = StdSignMsg.fromData({
    //   account_number: this.terrajs.address,
    //   chain_id: this.terrajs.network.chainID,
    //   fee: { gas: '500000', amount: [{ denom: 'uusd', amount: '75000'}] },
    //   memo: '',
    //   msgs: this.msgs.map(it => it.toData()),
    //   sequence: '',
    // });
    // this.loading = false;
  }

  async execute() {
    try {
      this.loading = true;
      this.loadingMsg = 'Broadcasting...';
      const postMsg = {
        msgs: this.msgs,
        fee: this.signMsg.fee,
        gasPrices: `${this.terrajs.lcdClient.config.gasPrices['uusd']}uusd`,
      };
      const res = await this.terrajs.walletController.post(postMsg);
      this.txhash = res.result.txhash;
      this.link = this.txhash && `https://${this.terrajs.settings.finder}/${this.terrajs.settings.chainID}/tx/${this.txhash}`;
      if (!res.success) {
        throw res;
      }
      this.executed = true;

      this.loadingMsg = 'Waiting for result...';
      do {
        const res2 = await this.httpClient.get<any>(`${this.terrajs.settings.lcd}/txs/${this.txhash}`,
          {
            observe: 'response',
          })
          .toPromise().catch(e => e);
        if (res2.ok) {
          if (res2.body.code || res2.body.error) {
            throw { message: 'Transaction failed', data: res2.body.code || res2.body.error };
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
