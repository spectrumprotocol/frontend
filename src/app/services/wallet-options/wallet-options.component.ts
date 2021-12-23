import { Component } from '@angular/core';
import { WalletInfo } from '@terra-money/wallet-provider';
import {MdbModalRef} from 'mdb-angular-ui-kit/modal';

@Component({
  selector: 'app-wallet-options',
  templateUrl: './wallet-options.component.html',
  styleUrls: ['./wallet-options.component.scss']
})
export class WalletOptionsComponent {

  wallets: WalletInfo[];

  constructor(
    private modalRef: MdbModalRef<WalletOptionsComponent>
  ) { }

  select(wallet: WalletInfo) {
    this.modalRef.close(wallet);
  }
}
