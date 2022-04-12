import {Component, HostListener, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Subscription} from 'rxjs';
import {TerrajsService} from '../../services/terrajs.service';
import {InfoService} from '../../services/info.service';
import {debounce} from 'utils-decorators';
import {PairStat, PoolInfo} from '../../services/farm_info/farm-info.service';
import {CONFIG} from '../../consts/config';
import {PairInfo} from '../../services/api/terraswap_factory/pair_info';
import {GoogleAnalyticsService} from 'ngx-google-analytics';
import {MdbModalService} from 'mdb-angular-ui-kit/modal';
import {MdbDropdownDirective} from 'mdb-angular-ui-kit/dropdown';

type AssetInfo = { native_token: { denom: string } } | { token: { contract_addr: string } };

export interface Vault {
  baseSymbol: string;
  denomSymbol: string;
  rewardSymbol: string;
  baseDecimals: number;
  baseUnit: number;
  baseAssetInfo: AssetInfo;
  denomDecimals: number;
  denomUnit: number;
  denomAssetInfo: AssetInfo;
  lpToken: string;
  pairInfo: PairInfo;
  poolInfo: PoolInfo;
  pairStat: PairStat;
  farmApy: number;
  specApy: number;
  compoundApy: number;
  stakeApy: number;
  apy: number;
  name: string;
  unitDisplay: string;
  unitDisplayDexAbbreviated: string;
  shortUnitDisplay: string;
  score: number;
  fullName: string;
  disabled: boolean;
  will_available_at_astroport: boolean;
  now_available_at_astroport: boolean;
  proxy_reward_not_yet_available: boolean;
  poolAprTotal: number;
}

export type SORT_BY = 'multiplier' | 'apy' | 'dpr' | 'tvl';

@Component({
  selector: 'app-vault',
  templateUrl: './vault.component.html',
  styleUrls: ['./vault.component.scss']
})
export class VaultComponent implements OnInit, OnDestroy {
  public innerWidth: any;
  loading = true;
  vaults: Vault[] = [];
  search: string;
  showDepositedPoolOnly = false;
  defaultSortBy: SORT_BY = 'multiplier';
  defaultActiveFarm = 'Active farms';
  sortBy: SORT_BY = this.defaultSortBy;
  activeFarm = this.defaultActiveFarm;
  UNIT = CONFIG.UNIT;
  myTvl = 0;
  height: number;
  isGrid: boolean;
  farmInfoDropdownList: string[];
  shouldBeGrid: boolean;
  @ViewChild('dropdownFarmFilter') dropdownFarmFilter: MdbDropdownDirective;
  @ViewChild('dropdownSortBy') dropdownSortBy: MdbDropdownDirective;
  private connected: Subscription;
  private heightChanged: Subscription;
  private onTransaction: Subscription;
  private lastSortBy: SORT_BY;
  private lastActiveFarm: string;

  private BLACKLIST: Set<string> = new Set(['Starterra']);


  constructor(
    public info: InfoService,
    public terrajs: TerrajsService,
    private modalService: MdbModalService,
    protected $gaService: GoogleAnalyticsService,
  ) {
    this.onResize(null);
  }

  async ngOnInit() {
    this.farmInfoDropdownList = [...new Set(this.info.farmInfos.filter(farmInfo => !this.BLACKLIST.has(farmInfo.farm)).map(farmInfo => farmInfo.farm))];
    this.showDepositedPoolOnly = localStorage.getItem('deposit') === 'true';
    this.loading = true;
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        this.loading = true;
        this.info.updateVaults();
        this.info.refreshPool();
        await this.info.initializeVaultData(connected);
        this.refresh(true);
        this.loading = false;
        this.height = await this.terrajs.getHeight();
        this.lastSortBy = undefined;
      });

    this.onTransaction = this.terrajs.transactionComplete.subscribe(async () => {
      await this.info.refreshRewardInfos();
      if (this.showDepositedPoolOnly) {
        this.refresh();
      }
      await this.info.updateMyTvl();
    });
    this.heightChanged = this.terrajs.heightChanged.subscribe(async i => {
      if (this.loading || !i || document.hidden) {
        return;
      }
      if (i % 10 === 0) {
        await Promise.all([this.info.refreshPool(), this.info.retrieveCachedStat(true)]);
        if (this.terrajs.isConnected) {
          await this.info.refreshRewardInfos();
          if (this.showDepositedPoolOnly) {
            this.refresh();
          }
          await this.info.updateMyTvl();
        }
      }
    });
  }

  setIsGrid(isGrid: boolean) {
    if (isGrid) {
      this.isGrid = true;
      localStorage.setItem('isGrid', 'true');
    } else {
      this.isGrid = false;
      localStorage.setItem('isGrid', 'false');
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.updateShouldBeGrid();
    if (this.shouldBeGrid || localStorage.getItem('isGrid') !== 'false') {
      this.isGrid = true;
    } else {
      this.isGrid = false;
    }
  }

  updateShouldBeGrid() {
    this.innerWidth = window.innerWidth;
    if (+this.innerWidth <= 575) {
      this.shouldBeGrid = true;
    } else {
      this.shouldBeGrid = false;
    }
  }

  ngOnDestroy() {
    this.connected.unsubscribe();
    this.heightChanged.unsubscribe();
    this.onTransaction.unsubscribe();
  }

  memoize(name: string) {
    if (name === 'deposit') {
      localStorage.setItem('deposit', `${this.showDepositedPoolOnly}`);
    }
  }

  @debounce(250)
  refresh(resetFilterOnEmpty?: boolean) {
    let vaults = this.activeFarm === 'Active farms'
      ? this.info.allVaults.filter(vault => !vault.disabled)
      : this.activeFarm === 'Disabled farms'
        ? this.info.allVaults.filter(vault => vault.disabled)
        : this.info.allVaults.filter(vault => vault.poolInfo.farm === this.activeFarm && !vault.disabled);
    if (this.lastSortBy !== this.sortBy || this.lastActiveFarm !== this.activeFarm || !this.search) {
      switch (this.sortBy) {
        case 'multiplier':
          vaults.sort((a, b) => b.score - a.score);
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
      this.lastActiveFarm = this.activeFarm;
    }
    if (this.showDepositedPoolOnly) {
      const oldVaults = vaults;
      vaults = vaults.filter(it => +this.info.rewardInfos?.[it.poolInfo.key]?.bond_amount >= 10);
      if (vaults.length === 0 && resetFilterOnEmpty) {
        this.showDepositedPoolOnly = false;
        vaults = oldVaults;
      }
    }
    if (this.search) {
      vaults = vaults.filter(it => `${it.baseSymbol}${it.denomSymbol}`.toLowerCase().includes(this.search.replace(/-/g, '').toLowerCase()));
    }
    this.vaults = vaults;
    this.dropdownFarmFilter.hide();
    this.dropdownSortBy.hide();
  }

  vaultId = (_: number, item: Vault) => item.poolInfo.key;

  async openYourTVL() {
    this.$gaService.event('CLICK_OPEN_YOUR_TVL');
    const modal = await import('./your-tvl/your-tvl.component');
    const ref = this.modalService.open(modal.YourTvlComponent, {
      ignoreBackdropClick: false,
    });
    await ref.onClose.toPromise();
  }

}
