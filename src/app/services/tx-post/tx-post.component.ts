import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Msg } from '@terra-money/terra.js';
import { MdbModalRef } from 'mdb-angular-ui-kit';
import { CONFIG } from '../../consts/config';
import { TerrajsService } from '../terrajs.service';
import { GoogleAnalyticsService } from 'ngx-google-analytics';

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
  failed = false;
  failMsg: string;
  signMsg: any;
  UNIT = CONFIG.UNIT;
  txhash: string;
  link: string;

  constructor(
    private httpClient: HttpClient,
    private modalRef: MdbModalRef<TxPostComponent>,
    private terrajs: TerrajsService,
    protected $gaService: GoogleAnalyticsService
  ) { }

  async ngOnInit() {
    try {
      if (!this.terrajs.isConnected) {
        throw new Error('please connect your wallet');
      }
      this.loadingMsg = 'Simulating...';
      this.signMsg = await this.terrajs.lcdClient.tx.create(this.terrajs.address, {
        msgs: this.msgs,
        feeDenoms: ['uusd']
      });
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
      const res = await this.terrajs.walletController.post({
        msgs: this.msgs,
        fee: this.signMsg.fee,
        gasPrices: `${this.terrajs.lcdClient.config.gasPrices['uusd']}uusd`,
      });
      this.txhash = res.result.txhash;
      this.link = this.txhash && `https://finder.extraterrestrial.money/${this.terrajs.settings.chainID}/tx/${this.txhash}`;
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
