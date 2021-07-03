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
    private route: ActivatedRoute
  ) {
    route.params.subscribe(val => {
      setTimeout(() => {
        if (this.terrajs.checkInstalled()) {
          this.terrajs.connect().then(() =>
            this.walletText = this.getWalletText()
          );
        }
      }, 2000)
    });
  }

  private heightChanged: Subscription;
  @ViewChild('dropdown') dropdown: MdbDropdownDirective;

  walletText = 'Connect Wallet';

  async ngOnInit() {
    setTimeout(() => {
      this.initWallet();
    }, 1000)
  }

  async initWallet() {
    if (!this.terrajs.checkInstalled()) {
      this.walletText = 'Please install Terra Station';
    } else if (this.terrajs.isConnected) {
      this.walletText = this.getWalletText();
    }
    this.heightChanged = this.terrajs.heightChanged.subscribe(async () => {
      await this.info.refreshBalance({ ust: true, spec: true });
    });
  }

  ngOnDestroy(): void {
    this.heightChanged.unsubscribe();
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
