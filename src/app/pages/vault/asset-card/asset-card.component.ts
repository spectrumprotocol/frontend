import {Component, Input, OnInit} from '@angular/core';
import {fade} from '../../../consts/animations';
import {Vault} from '../vault.component';
import {GoogleAnalyticsService} from 'ngx-google-analytics';
import {InfoService} from '../../../services/info.service';
import {LpBalancePipe} from '../../../pipes/lp-balance.pipe';
import {VaultDialogComponent} from './vault-dialog/vault-dialog.component';
import {MdbModalRef, MdbModalService} from 'mdb-angular-ui-kit/modal';
import {CONFIG} from '../../../consts/config';
import {
  FARM_TYPE_DEPOSIT_WITH_SINGLE_TOKEN,
  FARM_TYPE_DISPLAY_AS_PAIR_TOKEN,
  FARM_TYPE_DISPLAY_AS_SINGLE_TOKEN
} from '../../../services/farm_info/farm-info.service';
import {Denom} from '../../../consts/denom';
import {TerrajsService} from '../../../services/terrajs.service';

@Component({
  selector: 'app-asset-card',
  templateUrl: './asset-card.component.html',
  styleUrls: ['./asset-card.component.scss'],
  animations: [fade],
  providers: [LpBalancePipe]
})
export class AssetCardComponent implements OnInit {
  @Input() isGrid: boolean;
  @Input() vault: Vault;

  UNIT = CONFIG.UNIT;
  FARM_TYPE_DEPOSIT_WITH_SINGLE_TOKEN = FARM_TYPE_DEPOSIT_WITH_SINGLE_TOKEN;
  FARM_TYPE_DISPLAY_AS_SINGLE_TOKEN = FARM_TYPE_DISPLAY_AS_SINGLE_TOKEN;
  FARM_TYPE_DISPLAY_AS_PAIR_TOKEN = FARM_TYPE_DISPLAY_AS_PAIR_TOKEN;

  get NASSET_PSI_KEY() {
    return `${this.vault.poolInfo.dex}|${this.vault.poolInfo.baseTokenContract}|${this.terrajs.settings.nexusToken}`;
  }

  get PSI_UST_KEY() {
    return `Astroport|${this.terrajs.settings.nexusToken}|${Denom.USD}`;
  }

  modalRef: MdbModalRef<VaultDialogComponent>;

  constructor(
    protected $gaService: GoogleAnalyticsService,
    public info: InfoService,
    private terrajs: TerrajsService,
    private modalService: MdbModalService
  ) {
  }

  ngOnInit() {
  }

  async openModal() {
    this.modalRef = this.modalService.open(VaultDialogComponent, {
      modalClass: 'modal-vault-dialog modal-dialog',
      data: {
        vault: this.vault
      }
    });
  }
}
