import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { TerrajsService } from '../services/terrajs.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { ModalService } from '../services/modal.service';
import { TruncatePipe } from '../pipes/truncate.pipe';
import { InfoService } from '../services/info.service';
import { Subscription, switchMap, tap } from 'rxjs';
import { MdbDropdownDirective } from 'mdb-angular-ui-kit/dropdown';
import { TnsNameService } from '../services/api/tns-name.service';

@Component({
  selector: 'app-menubar',
  templateUrl: './menubar.component.html',
  styleUrls: ['./menubar.component.scss']
})
export class MenubarComponent implements OnInit, OnDestroy {

  @ViewChild('dropdown') dropdown: MdbDropdownDirective;

  constructor(
    public terrajs: TerrajsService,
    public info: InfoService,
    private clipboard: Clipboard,
    private modelService: ModalService,
    private truncate: TruncatePipe,
    private tnsNameService: TnsNameService,
  ) { }

  private processes: Subscription;

  walletText = 'Connect Wallet';
  tnsName = null;

  async ngOnInit() {
    // NOTE : Create a composite subscription, we will compose everything into it and unsub everything once on destroy.
    this.processes = new Subscription();
    this.processes.add(
      this.terrajs.connected.pipe(
        tap(async (connected) => {
          if (connected) {
            this.walletText = this.getWalletText();
            this.getTNSName().then(tnsName => this.tnsName = tnsName);
          } else {
            this.walletText = 'Connect Wallet';
          }
        }),
        // NOTE : SwitchMap means "Subscribe, in a subscribe, we are passing control to "initWallet".
        // Observables and promises are fully interoperable
        switchMap(() => {
          // NOTE : Will wait until the first state who is not "initialized".
          return this.initWallet();
        }),
        tap(async (installed) => {
          if (!installed) {
            this.walletText = 'Please install Terra Station';
          } else if (this.terrajs.isConnected) {
            this.walletText = this.getWalletText();
            this.getTNSName().then(tnsName => this.tnsName = tnsName);
            await this.info.refreshBalance({ native_token: true, spec: true });
          }
        })
      ).subscribe()
    );
  }

  private async initWallet(): Promise<boolean> {
    return await this.terrajs.checkInstalled();
  }

  ngOnDestroy(): void {
    this.processes.unsubscribe();
  }

  private getWalletText() {
    return this.truncate.transform(this.terrajs.address);
  }

  private async getTNSName() {
    const { name } = await this.tnsNameService.query({
      get_name: {
        address: this.terrajs.address
      }
    });
    return this.truncate.transform(name);
  }

  async connect() {
    await this.terrajs.connect();
    this.walletText = this.getWalletText();
    this.getTNSName().then(tnsName => this.tnsName = tnsName);
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

  async copyTNS() {
    this.clipboard.copy(this.tnsName);
    this.modelService.notify('TNS address copied');
    this.dropdown.hide();
  }
}
