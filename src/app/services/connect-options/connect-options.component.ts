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
  walletExtensionsForInstall = [
    {
      name: 'Terra Station Wallet',
      identifier: 'station',
      icon: 'https://assets.terra.money/icon/station-extension/icon.png',
      installUrl: 'https://chrome.google.com/webstore/detail/terra-station-wallet/aiifbnbfobpmeekipheeijimdpnlpgpp'
    },
    {
      name: 'Leap Wallet',
      identifier: 'leap-wallet',
      icon: 'https://leapwallet.io/icon.png',
      installUrl: 'https://chrome.google.com/webstore/detail/leap-wallet/aijcbedoijmgnlmjeegjaglmepbmpkpi'
    },
    {
      name: 'XDEFI Wallet',
      identifier: 'xdefi-wallet',
      icon: 'https://xdefi-prod-common-ui.s3.eu-west-1.amazonaws.com/logo.svg',
      installUrl: 'https://chrome.google.com/webstore/detail/xdefi-wallet/hmeobnfnfcmdkdcmlblgagmfpfboieaf'
    }
  ];

  constructor(
    private modalRef: MdbModalRef<ConnectOptionsComponent>
  ) {
    // @ts-ignore
    this.walletExtensions = window.terraWallets ?? [];
  }

  connect(type: string, identifier: string) {
    this.modalRef.close({type, identifier});
  }

  findWalletExtensionIdentifier(identifier: string){
    return !!this.walletExtensions.find(w => w.identifier === identifier);
  }

}
