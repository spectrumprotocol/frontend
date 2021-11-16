import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { TerrajsService } from '../../services/terrajs.service';
import { InfoService } from '../../services/info.service';
import { debounce } from 'utils-decorators';
import {FarmInfoService, PairStat, PoolInfo} from '../../services/farm_info/farm-info.service';
import { CONFIG } from '../../consts/config';
import { MdbDropdownDirective, MdbModalService } from 'mdb-angular-ui-kit';
import { PairInfo } from '../../services/api/terraswap_factory/pair_info';
import { GoogleAnalyticsService } from 'ngx-google-analytics';

export interface Vault {
  symbol: string;
  assetToken: string;
  lpToken: string;
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
  vaults: Vault[] = [];
  search: string;
  showDepositedPoolOnly = false;
  sortBy = 'multiplier';
  activeFarm = 'All';
  UNIT = CONFIG.UNIT;
  myTvl = 0;
  height: number;
  farmInfoDropdownList: FarmInfoService[];

  @ViewChild('dropdownFarmFilter') dropdownFarmFilter: MdbDropdownDirective;
  @ViewChild('dropdownSortBy') dropdownSortBy: MdbDropdownDirective;

  constructor(
    public info: InfoService,
    public terrajs: TerrajsService,
    private modalService: MdbModalService,
    protected $gaService: GoogleAnalyticsService,
  ) { }

  async ngOnInit() {
    this.farmInfoDropdownList = [...new Map(this.info.farmInfos.map(farmInfo => [farmInfo.farm, farmInfo])).values()];
    this.showDepositedPoolOnly = localStorage.getItem('deposit') === 'true';
    this.loading = true;
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        this.loading = true;
        this.info.updateVaults();
        this.refresh();
        this.info.refreshPool();
        await this.info.initializeVaultData(connected);
        this.refresh();
        this.loading = false;
        this.height = await this.terrajs.getHeight();
        this.lastSortBy = undefined;
      });
    this.heightChanged = this.terrajs.heightChanged.subscribe(async i => {
      if (this.loading || !i) {
        return;
      }
      if (i % 3 === 0) {
        await Promise.all([this.info.refreshPool(), this.info.retrieveCachedStat(true)]);
      }
      if (this.terrajs.isConnected) {
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
    let vaults = this.activeFarm === 'All' ? this.info.allVaults : this.info.allVaults.filter(vault => vault.poolInfo.farm === this.activeFarm);
    if (this.lastSortBy !== this.sortBy) {
      switch (this.sortBy) {
        case 'multiplier':
          vaults.sort((a, b) => (b.pairStat?.multiplier || 0) - (a.pairStat?.multiplier || 0));
          break;
        case 'apy':
          vaults.sort((a, b) => b.apy - a.apy);
          break;
        case 'dpr':
          vaults.sort((a, b) => (b.pairStat?.dpr || 0) - (a.pairStat?.dpr || 0));
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
    this.dropdownFarmFilter.hide();
    this.dropdownSortBy.hide();
  }

  vaultId = (_: number, item: Vault) => item.symbol;

  async openYourTVL() {
    this.$gaService.event('CLICK_OPEN_YOUR_TVL');
    const modal = await import('./your-tvl/your-tvl.component');
    const ref = this.modalService.open(modal.YourTvlComponent, {
      ignoreBackdropClick: false,
    });
    await ref.onClose.toPromise();
  }

}
