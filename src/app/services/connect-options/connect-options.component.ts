import { Component } from '@angular/core';
import {MdbModalRef} from 'mdb-angular-ui-kit/modal';

@Component({
  selector: 'app-connect-options',
  templateUrl: './connect-options.component.html',
  styleUrls: ['./connect-options.component.scss']
})
export class ConnectOptionsComponent {
  types: string[];
  walletExtensions: any;

  constructor(
    private modalRef: MdbModalRef<ConnectOptionsComponent>
  ) {
    // @ts-ignore
    this.walletExtensions = window.terraWallets ?? [];
  }

  connect(type: string, identifier: string) {
    this.modalRef.close({type, identifier});
  }

}
