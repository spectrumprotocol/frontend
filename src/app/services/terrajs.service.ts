import {Injectable, OnDestroy} from '@angular/core';
import {Coin, Extension, LCDClient, Msg, SyncTxBroadcastResult} from '@terra-money/terra.js';
import {ISettings, networks} from '../consts/networks';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, interval, Subscription} from 'rxjs';
import {MdbModalService} from 'mdb-angular-ui-kit';
import {startWith} from 'rxjs/operators';

export const BLOCK_TIME = 6500; // 6.5s
export const DEFAULT_NETWORK = 'mainnet';

export type Result = SyncTxBroadcastResult.Data;
export interface PostResponse {
  id: number;
  origin: string;
  success: boolean;
  result?: Result;
  error?: { code: number; message?: string; };
}
export interface GetResponse {
  height: number;
  result: object;
}
export interface NetworkInfo {
  name: string;
  chainID: string;
  lcd: string;
  fcd: string;
  ws: string;
}
export interface ExecuteOptions {
  coin?: Coin.Data;
}

@Injectable({
  providedIn: 'root'
})
export class TerrajsService implements OnDestroy {
  connected = new BehaviorSubject(false);
  settings: ISettings = networks[DEFAULT_NETWORK];
  address: string;
  network: NetworkInfo;
  isConnected: boolean;
  lcdClient: LCDClient;
  extension: Extension;
  heightChanged = interval(BLOCK_TIME).pipe(startWith(0));
  private height = 0;
  private posting = false;
  private subscription: Subscription;

  constructor(
    private httpClient: HttpClient,
    private modalService: MdbModalService,
  ) {
    this.extension = new Extension();
    this.subscription = this.heightChanged.subscribe(() => this.height++);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  checkInstalled(): boolean {
    return this.extension.isAvailable;
  }

  async getHeight(): Promise<number> {
    if (this.height <= 1) {
      await this.get('wasm/parameters'); // call something to get height
    }
    return this.height;
  }

  async connect(auto?: boolean): Promise<void> {
    if (this.isConnected) {
      return;
    }
    if (auto && !localStorage.getItem('connect')) {
      return;
    }
    if (!this.extension.isAvailable) {
      if (auto) {
        return;
      }
      throw new Error('Cannot connect to wallet');
    }
    const connectRes = await this.extension.request('connect');
    this.address = connectRes.payload['address'];

    const infoRes = await this.extension.request('info');
    this.network = infoRes.payload as NetworkInfo;

    this.settings = networks[this.network.name];

    const gasPrices = await this.httpClient.get<Record<string, string>>(`${this.settings.fcd}/v1/txs/gas_prices`).toPromise();
    this.lcdClient = new LCDClient({
      URL: this.network.lcd,
      chainID: this.network.chainID,
      gasPrices,
    });

    this.isConnected = true;
    this.connected.next(true);
    localStorage.setItem('connect', 'true');
  }

  disconnect() {
    localStorage.removeItem('connect');
    location.reload();
  }

  async get(path: string, params?: Record<string, string>, headers?: Record<string, string>) {
    const res = await this.httpClient.get<GetResponse>(`${this.settings.lcd}/${path}`, {
      params,
      headers,
    }).toPromise();
    this.height = +res.height;
    return res.result as any;
  }

  async post(msgs: Msg[] | Msg) {
    if (this.posting) {
      return;
    }
    try {
      this.posting = true;
      const modal = await import('./tx-post/tx-post.component');
      const ref = this.modalService.open(modal.TxPostComponent, {
        keyboard: false,
        ignoreBackdropClick: true,
        data: {
          msgs: msgs instanceof Array ? msgs : [msgs],
        }
      });
      const result = await ref.onClose.toPromise();
      if (!result) {
        throw new Error('Transaction canceled');
      }
    } finally {
      this.posting = false;
    }
  }

  toDate(height: number) {
    const now = Date.now();
    return new Date(now + (height - this.height) * BLOCK_TIME);
  }

}
