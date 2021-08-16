import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { TerrajsService } from '../../services/terrajs.service';
import { InfoService } from '../../services/info.service';
import { debounce } from 'utils-decorators';
import { PairStat, PoolInfo } from '../../services/farm_info/farm-info.service';
import { CONFIG } from '../../consts/config';
import { MdbDropdownDirective, MdbModalService } from 'mdb-angular-ui-kit';
import { PairInfo } from '../../services/api/terraswap_factory/pair_info';
import { GovService } from 'src/app/services/api/gov.service';
import { TotalValueItem } from './your-tvl/your-tvl.component';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { BalancePipe } from 'src/app/pipes/balance.pipe';
import { LpBalancePipe } from 'src/app/pipes/lp-balance.pipe';

export interface Vault {
  symbol: string;
  assetToken: string;
  pairInfo: PairInfo;
  poolInfo: PoolInfo;
  pairStat: PairStat;
  farmApy: number;
  specApy: number;
  compoundApy: number;
  stakeApy: number;
  apy: number;
}

@Component({
  selector: 'app-vault',
  templateUrl: './vault.component.html',
  styleUrls: ['./vault.component.scss']
})
export class VaultComponent implements OnInit, OnDestroy {
  private connected: Subscription;
  private heightChanged: Subscription;
  private lastSortBy: string;

  loading = true;
  allVaults: Vault[];
  vaults: Vault[];
  search: string;
  showDepositedPoolOnly = false;
  sortBy = 'multiplier';
  UNIT = CONFIG.UNIT;
  myStaked: string;
  myTvl = 0;
  height: number;

  @ViewChild('dropdown') dropdown: MdbDropdownDirective;

  totalValueItems: TotalValueItem[] = [];

  constructor(
    private balancePipe: BalancePipe,
    private lpBalancePipe: LpBalancePipe,
    private gov: GovService,
    public info: InfoService,
    public terrajs: TerrajsService,
    private modalService: MdbModalService,
    protected $gaService: GoogleAnalyticsService,
  ) { }

  async ngOnInit() {
    this.showDepositedPoolOnly = localStorage.getItem('deposit') === 'true';
    this.refresh();
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        this.loading = true;
        await this.info.initializeVaultData(connected);
        this.refresh();
        this.loading = false;
        this.height = await this.terrajs.getHeight();
        this.lastSortBy = undefined;
      });
    this.heightChanged = this.terrajs.heightChanged.subscribe(async i => {
      if (i % 3 === 0) {
        await this.info.refreshStat();
      }
      if (i && this.terrajs.isConnected) {
        await this.info.refreshRewardInfos();
        if (this.showDepositedPoolOnly) {
          this.refresh();
        }
        await this.info.updateMyTvl();
      }
    });
  }

  ngOnDestroy() {
    this.connected.unsubscribe();
    this.heightChanged.unsubscribe();
  }

  memoize(name: string) {
    if (name === 'deposit') {
      localStorage.setItem('deposit', `${this.showDepositedPoolOnly}`);
    }
  }

  @debounce(250)
  refresh() {
    let vaults = this.info.allVaults;
    if (this.lastSortBy !== this.sortBy) {
      switch (this.sortBy) {
        case 'multiplier':
          vaults.sort((a, b) => (b.pairStat?.multiplier || 0) - (a.pairStat?.multiplier || 0));
          break;
        case 'apy':
          vaults.sort((a, b) => b.apy - a.apy);
          break;
        case 'tvl':
          vaults.sort((a, b) => (+b.pairStat?.tvl || 0) - (+a.pairStat?.tvl || 0));
          break;
      }
      this.lastSortBy = this.sortBy;
    }
    if (this.showDepositedPoolOnly) {
      vaults = vaults.filter(it => +this.info.rewardInfos?.[it.assetToken]?.bond_amount >= 10);
    }
    if (this.search) {
      vaults = vaults.filter(it => it.symbol.toLowerCase().includes(this.search.toLowerCase()));
    }
    this.vaults = vaults;
    this.dropdown.hide();
  }

  vaultId = (_: number, item: Vault) => item.symbol;

  async openYourTVL() {
    if (this.cannotOpenYourTVL()) {
      return;
    }

    this.$gaService.event('CLICK_OPEN_YOUR_TVL');
    this.initTVLowerSection();
    const modal = await import('./your-tvl/your-tvl.component');
    const ref = this.modalService.open(modal.YourTvlComponent, {
      ignoreBackdropClick: false,
      data: {
        totalValueItems: this.totalValueItems
      }
    });
    const result = await ref.onClose.toPromise();
  }

  cannotOpenYourTVL() {
    return this.loading || !this.terrajs.isConnected;
  }

  initTVLowerSection() {
    const item0: TotalValueItem = {
      valueRef: 'item0',
      title: 'Gov staked SPEC'
    };
    const item1: TotalValueItem = {
      valueRef: 'item1',
      title: 'Total Rewards'
    };

    if (this.totalValueItems.length !== 2) {
      this.totalValueItems = [item0, item1];
    }
  }



}
