import { Injectable, OnDestroy } from '@angular/core';
import { Coin, LCDClient, Msg, MsgExecuteContract, SyncTxBroadcastResult } from '@terra-money/terra.js';
import { ISettings, networks } from '../consts/networks';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, interval, Subscription } from 'rxjs';
import { MdbModalService } from 'mdb-angular-ui-kit';
import { filter, startWith } from 'rxjs/operators';
import { ConnectType, WalletController, WalletInfo, WalletStates, WalletStatus } from '@terra-money/wallet-provider';
import { checkAvailableExtension } from '@terra-money/wallet-provider/utils/checkAvailableExtension';
import { ModalService } from './modal.service';
import { throttleAsync } from 'utils-decorators';

export const BLOCK_TIME = 6500; // 6.5s
export const DEFAULT_NETWORK = 'bombay';

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
  fcd?: string;
  ws?: string;
}
export interface ExecuteOptions {
  coin?: Coin.Data;
}

interface ConnectedState {
  status: WalletStatus;
  network: NetworkInfo;
  wallets?: WalletInfo[];
}

const mainnet: NetworkInfo = {
  name: 'mainnet',
  chainID: 'columbus-4',
  lcd: 'https://lcd.terra.dev',
};

const testnet: NetworkInfo = {
  name: 'testnet',
  chainID: 'tequila-0004',
  lcd: 'https://tequila-lcd.terra.dev',
};

const bombay: NetworkInfo = {
  name: 'bombay',
  chainID: 'bombay-10',
  lcd: 'https://bombay-lcd.terra.dev',
};

const walletConnectChainIds: Record<number, NetworkInfo> = {
  0: testnet,
  1: mainnet,
  3: bombay,
};

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
  walletController: WalletController;
  heightChanged = interval(BLOCK_TIME).pipe(startWith(0));
  private height = 0;
  private posting = false;
  private subscription: Subscription;

  constructor(
    private httpClient: HttpClient,
    private modal: ModalService,
    private modalService: MdbModalService,
  ) {
    this.walletController = new WalletController({
      defaultNetwork: mainnet,
      walletConnectChainIds,
      connectorOpts: {
        bridge: 'https://walletconnect.terra.dev/'
      },
      waitingChromeExtensionInstallCheck: 1000
    });
    this.subscription = this.heightChanged.subscribe(() => this.height++);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  async checkInstalled() {
    await checkAvailableExtension(1500, true);
    const types = await firstValueFrom(this.walletController.availableInstallTypes());
    return types.length === 0;
  }

  getConnectTypes() {
    return firstValueFrom(this.walletController.availableConnectTypes())
      .then(it => it.filter(t => t !== 'READONLY'));
  }

  async getHeight(force?: boolean): Promise<number> {
    if (this.height <= 1 || force) {
      await this.get('wasm/parameters'); // call something to get height
    }
    return this.height;
  }

  async connect(auto?: boolean): Promise<void> {
    if (this.isConnected) {
      return;
    }
    let type: string;
    let address: string;
    const connectTypes = await this.getConnectTypes();
    if (auto) {
      type = localStorage.getItem('connect');
      if (!type) {
        return;
      }

      // migrate from previous version
      if (type === 'true') {
        type = 'CHROME_EXTENSION';
      }
      address = localStorage.getItem('address');
    } else {
      const installTypes = await firstValueFrom(this.walletController.availableInstallTypes());
      const types = connectTypes.concat(installTypes);
      if (types.length === 0) {
        this.modal.alert('No connection option', { iconType: 'danger' });
        throw new Error('No connection option');
      } else if (types.length === 1) {
        type = types[0];
      } else {
        const modal = await import('./connect-options/connect-options.component');
        const ref = this.modalService.open(modal.ConnectOptionsComponent, {
          data: { types }
        });
        type = await ref.onClose.toPromise();
      }
      if (!type) {
        throw new Error('Nothing selected');
      }
      if (installTypes.includes(type as ConnectType)) {
        this.walletController.install(type as ConnectType);
        return;
      }
    }
    if (!connectTypes.includes(type as ConnectType)) {
      if (auto) {
        return;
      }
      throw new Error('Cannot connect to wallet');
    }
    if (!auto || type !== 'WALLETCONNECT') {
      this.walletController.connect(type as ConnectType);
    }
    const state: ConnectedState = await firstValueFrom(this.walletController.states()
      .pipe(filter((it: WalletStates) => it.status === WalletStatus.WALLET_CONNECTED)));

    let wallet: WalletInfo;
    if (state.wallets.length === 0) {
      this.modal.alert('No wallet, please setup wallet first', { iconType: 'danger' });
      throw new Error('No wallet');
    } else if (state.wallets.length === 1) {
      wallet = state.wallets[0];
    } else {
      if (address) {
        wallet = state.wallets.find(it => it.terraAddress === address);
      }
      if (!wallet) {
        const modal = await import('./wallet-options/wallet-options.component');
        const ref = this.modalService.open(modal.WalletOptionsComponent, {
          data: {
            wallets: state.wallets
          }
        });
        wallet = await ref.onClose.toPromise();
      }
    }
    this.address = state.wallets[0].terraAddress;
    this.network = state.network;
    this.settings = networks[this.network.name];

    const gasPrices = await this.httpClient.get<Record<string, string>>(`${this.settings.fcd}/v1/txs/gas_prices`).toPromise();
    this.lcdClient = new LCDClient({
      URL: this.network.lcd,
      chainID: this.network.chainID,
      gasPrices,
    });

    this.isConnected = true;
    this.connected.next(true);
    localStorage.setItem('connect', type);
    localStorage.setItem('address', this.address);
  }

  disconnect() {
    this.walletController.disconnect();
    localStorage.removeItem('connect');
    localStorage.removeItem('address');
    location.reload();
  }

  @throttleAsync(20)
  async get(path: string, params?: Record<string, string>, headers?: Record<string, string>) {
    const res = await this.httpClient.get<GetResponse>(`${this.settings.lcd}/${path}`, {
      params,
      headers,
    }).toPromise();
    this.height = +res.height;
    return res.result as any;
  }

  async getFCD(path: string, params?: Record<string, string>, headers?: Record<string, string>) {
    const res = await this.httpClient.get<GetResponse>(`${this.settings.fcd}/${path}`, {
      params,
      headers,
    }).toPromise();
    return res as any;
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
