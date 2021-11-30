import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { fade } from '../../../consts/animations';
import { Vault } from '../vault.component';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { InfoService } from '../../../services/info.service';
import { LpBalancePipe } from '../../../pipes/lp-balance.pipe';
import { VaultDialogComponent } from './vault-dialog/vault-dialog.component';
import {MdbModalRef, MdbModalService} from 'mdb-angular-ui-kit/modal';

@Component({
  selector: 'app-asset-card',
  templateUrl: './asset-card.component.html',
  styleUrls: ['./asset-card.component.scss'],
  animations: [fade],
  providers: [LpBalancePipe]
})
export class AssetCardComponent implements OnInit {
  @Input() isGrid;
  @Input() vault: Vault;

  modalRef: MdbModalRef<VaultDialogComponent>;
  constructor(
    protected $gaService: GoogleAnalyticsService,
    public info: InfoService,
    private modalService: MdbModalService
  ) { }

  ngOnInit() {
  }

  async openModal() {
    this.modalRef = this.modalService.open(VaultDialogComponent, {
      modalClass: 'modal-lg modal-dialog-centered',
      data: {
        vault: this.vault
    }});
  }

}
