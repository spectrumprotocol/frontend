import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { TerrajsService } from '../services/terrajs.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { ModalService } from '../services/modal.service';
import { TruncatePipe } from '../pipes/truncate.pipe';
import { InfoService } from '../services/info.service';
import { Subscription } from 'rxjs';
import { MdbDropdownDirective } from 'mdb-angular-ui-kit';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-menubar',
  templateUrl: './menubar.component.html',
  styleUrls: ['./menubar.component.scss']
})
export class MenubarComponent implements OnInit, OnDestroy {

  constructor(
    public terrajs: TerrajsService,
    public info: InfoService,
    private clipboard: Clipboard,
    private modelService: ModalService,
    private truncate: TruncatePipe,
  ) { }

  private heightChanged: Subscription;
  private connected: Subscription;
  @ViewChild('dropdown') dropdown: MdbDropdownDirective;

  walletText = 'Connect Wallet';

  async ngOnInit() {
    this.heightChanged = this.terrajs.heightChanged.subscribe(async () => {
      await this.info.refreshBalance({ ust: true, spec: true });
    });
    this.connected = this.terrajs.connected.subscribe(connected => {
      if (connected) {
        this.walletText = this.getWalletText();
      } else {
        this.walletText = 'Connect Wallet';
      }
    });

    // delay to wait for extension to load
    setTimeout(() => this.initWallet(), 1000);
  }

  async initWallet() {
    if (!this.terrajs.checkInstalled()) {
      this.walletText = 'Please install Terra Station';
    } else if (this.terrajs.isConnected) {
      this.walletText = this.getWalletText();
    }
  }

  ngOnDestroy(): void {
    this.heightChanged.unsubscribe();
    this.connected.unsubscribe();
  }

  private getWalletText() {
    return `${this.truncate.transform(this.terrajs.address)} (${this.terrajs.network.name})`;
  }

  async connect() {
    if (this.terrajs.checkInstalled()) {
      await this.terrajs.connect();
      this.walletText = this.getWalletText();
    } else {
      window.open('https://chrome.google.com/webstore/detail/terra-station/aiifbnbfobpmeekipheeijimdpnlpgpp', '_blank');
    }
  }

  async disconnect() {
    this.terrajs.disconnect();
    this.walletText = 'Connect Wallet';
  }

  async copy() {
    this.clipboard.copy(this.terrajs.address);
    this.modelService.notify('address copied');
    this.dropdown.hide();
  }
}
