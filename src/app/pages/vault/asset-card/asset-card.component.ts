import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Coin, Coins, MsgExecuteContract } from '@terra-money/terra.js';
import { fade } from '../../../consts/animations';
import { CONFIG } from '../../../consts/config';
import { toBase64 } from '../../../libs/base64';
import { div, floor, floor18Decimal, floorSixDecimal, gt, minus, times } from '../../../libs/math';
import { TerrajsService } from '../../../services/terrajs.service';
import { Vault } from '../vault.component';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { InfoService } from '../../../services/info.service';
import { Subscription } from 'rxjs';
import BigNumber from 'bignumber.js';
import { debounce } from 'utils-decorators';
import { Options as NgxSliderOptions } from '@angular-slider/ngx-slider';
import { LpBalancePipe } from '../../../pipes/lp-balance.pipe';
import { TokenService } from '../../../services/api/token.service';
import { TerraSwapService } from '../../../services/api/terraswap.service';
import { Denom } from '../../../consts/denom';
import { StakerService } from '../../../services/api/staker.service';
import { ExecuteMsg as StakerExecuteMsg } from '../../../services/api/staker/execute_msg';
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
    // this.terrajs.getHeight().then(h => this.height = h);
    // this.heightChanged = this.terrajs.heightChanged.subscribe(async () => {
    //   if (this.terrajs.isConnected) {
    //     const tasks: Promise<any>[] = [];
    //     if (this.vault.poolInfo.pairSymbol !== 'UST') {
    //       tasks.push(this.info.refreshPoolResponse(this.vault.poolInfo.farmTokenContract));
    //     }
    //     tasks.push(this.info.refreshPoolResponse(this.vault.assetToken));
    //     await Promise.all(tasks);
    //   }
    // });
  }

  async openModal() {
    this.modalRef = this.modalService.open(VaultDialogComponent, {
      modalClass: 'modal-lg modal-dialog-centered',
      data: {
        vault: this.vault
    }});
  }

}
