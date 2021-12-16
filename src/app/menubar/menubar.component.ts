import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { TerrajsService } from '../services/terrajs.service';
import { Clipboard } from '@angular/cdk/clipboard';
import { ModalService } from '../services/modal.service';
import { TruncatePipe } from '../pipes/truncate.pipe';
import { InfoService } from '../services/info.service';
import { Subscription, switchMap, tap } from 'rxjs';
import { MdbDropdownDirective } from 'mdb-angular-ui-kit/dropdown';

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
  ) { }

  private processes: Subscription;

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
        switchMap(() => {
          // NOTE : Will wait until the first state who is not "initialized".
          return this.initWallet();
        }),
        tap((installed) => {
          if (!installed) {
            this.walletText = 'Please install Terra Station';
          } else if (this.terrajs.isConnected) {
            this.walletText = this.getWalletText();
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

    // this.wasm.migrate(this.terrajs.settings.wallet, 26715, {
    //   aust_token: this.terrajs.settings.austToken,
    //   anchor_market: this.terrajs.settings.anchorMarket,
    //   terraswap_factory: this.terrajs.settings.terraSwapFactory,
    //   spectrum_farm: this.terrajs.settings.specFarm,
    // });

    // burnvault = terra1l3g2yv5cqwdtrxeun4a76jkq45gwwm682usvs4
    // controller = terra197ghuma43wdw7nydpmszxdje3naswnls4x7xq9

    // this.wasm.instantiate(26715, {
    //   owner: this.terrajs.address,
    //   spectrum_token: this.terrajs.settings.specToken,
    //   spectrum_gov: this.terrajs.settings.gov,
    //   aust_token: this.terrajs.settings.austToken,
    //   anchor_market: this.terrajs.settings.anchorMarket,
    //   terraswap_factory: this.terrajs.settings.terraSwapFactory,
    //   spectrum_farm: this.terrajs.settings.specFarm,
    // });

    // this.wallet.handle('terra1l3g2yv5cqwdtrxeun4a76jkq45gwwm682usvs4', {
    //   upsert_share: {
    //     address: 'terra197ghuma43wdw7nydpmszxdje3naswnls4x7xq9',
    //     disable_withdraw: true,
    //   }
    // });

    // await this.wasm.migrate(this.terrajs.settings.nEthPsiFarm, 26963, {
    //   anchor_market: this.terrajs.settings.anchorMarket,
    //   aust_token: this.terrajs.settings.austToken,
    //   terraswap_factory: this.terrajs.settings.terraSwapFactory,
    // });
    // await this.wasm.migrate(this.terrajs.settings.nLunaPsiFarm, 26963, {
    //   anchor_market: this.terrajs.settings.anchorMarket,
    //   aust_token: this.terrajs.settings.austToken,
    //   terraswap_factory: this.terrajs.settings.terraSwapFactory,
    // });

    // await this.wasm.execute(this.terrajs.settings.nLunaPsiFarm, { compound: {}});
    // await this.wasm.execute(this.terrajs.settings.nEthPsiFarm, { compound: {}});
  }
}
