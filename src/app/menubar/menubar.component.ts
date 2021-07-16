import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { TerrajsService } from '../services/terrajs.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { ModalService } from '../services/modal.service';
import { TruncatePipe } from '../pipes/truncate.pipe';
import { InfoService } from '../services/info.service';
import { debounceTime, Subscription, switchMap, tap } from 'rxjs';
import { MdbDropdownDirective } from 'mdb-angular-ui-kit';

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

  private processes: Subscription;
  @ViewChild('dropdown') dropdown: MdbDropdownDirective;

  walletText = 'Connect Wallet';

  async ngOnInit() {
    // NOTE : Create a composite subscription, we will compose everything into it and unsub everything once on destroy.
    this.processes = new Subscription();
    this.processes.add(
      this.terrajs.heightChanged.pipe(
        tap(async () => {
          await this.info.refreshBalance({ ust: true, spec: true });
        })
      ).subscribe()
    );

    this.processes.add(
      this.terrajs.connected.pipe(
        tap((connected) => {
          if (connected) {
            this.walletText = this.getWalletText();
          } else {
            this.walletText = 'Connect Wallet';
          }
        }),
        // NOTE : SwitchMap means "Subscribe, in a subscribe, we are passing control to "initWallet".
        // Observables and promises are fully interoperable
        debounceTime(1000),
        switchMap(() => {
          return this.initWallet();
        }),
      ).subscribe()
    );
  }

  private async initWallet() {
    const installed = await this.terrajs.checkInstalled();
    if (!installed) {
      this.walletText = 'Please install Terra Station';
    } else if (this.terrajs.isConnected) {
      this.walletText = this.getWalletText();
    }
  }

  ngOnDestroy(): void {
    this.processes.unsubscribe();
  }

  private getWalletText() {
    return `${this.truncate.transform(this.terrajs.address)} (${this.terrajs.network.name})`;
  }

  async connect() {
    await this.terrajs.connect();
    this.walletText = this.getWalletText();
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
