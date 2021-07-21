import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { TerrajsService } from '../../services/terrajs.service';
import { InfoService } from '../../services/info.service';
import { debounce } from 'utils-decorators';
import { PairStat, PoolInfo } from '../../services/farm_info/farm-info.service';
import { CONFIG } from '../../consts/config';
import { MdbDropdownDirective } from 'mdb-angular-ui-kit';
import { PairInfo } from '../../services/api/terraswap_factory/pair_info';
import { GovService } from 'src/app/services/api/gov.service';
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

  constructor(
    private balancePipe: BalancePipe,
    private lpBalancePipe: LpBalancePipe,
    private gov: GovService,
    public info: InfoService,
    private terrajs: TerrajsService,
  ) { }

  async ngOnInit() {
    this.showDepositedPoolOnly = localStorage.getItem('deposit') === 'true';
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        this.loading = true;
        this.updateVaults();

        const tasks: Promise<any>[] = [];
        tasks.push(this.info.ensureCoinInfos());
        tasks.push(this.info.refreshStat());
        tasks.push(this.info.refreshLock());
        if (connected) {
          tasks.push(this.info.refreshRewardInfos());
          tasks.push(this.info.refreshPoolInfo());
          tasks.push(this.gov.balance()
            .then(it => this.myStaked = it.balance));
        }

        await Promise.all(tasks);
        this.updateVaults();
        this.updateMyTvl();
        this.loading = false;
        this.height = await this.terrajs.getHeight();
      });
    this.heightChanged = this.terrajs.heightChanged.subscribe(async i => {
      if (i % 3 === 0) {
        this.info.refreshStat();
      }
      if (i && this.terrajs.isConnected) {
        await this.info.refreshRewardInfos();
        if (this.showDepositedPoolOnly) {
          this.refresh();
        }
        this.updateMyTvl();
      }
    });
  }

  ngOnDestroy() {
    this.connected.unsubscribe();
    this.heightChanged.unsubscribe();
  }

  private updateVaults() {
    const token = this.terrajs.settings.specToken;
    if (!this.info.coinInfos?.[token]) {
      return;
    }
    this.allVaults = [];
    for (const key of Object.keys(this.info.poolInfos)) {
      const pairStat = this.info.stat?.pairs[key];
      const poolApr = pairStat?.poolApr || 0;
      const poolApy = pairStat?.poolApy || 0;
      const specApr = pairStat?.specApr || 0;
      const govApr = this.info.stat?.govApr || 0;
      const specApy = specApr + specApr * govApr / 2;
      const compoundApy = poolApy + specApy;
      const farmApr = pairStat?.farmApr || 0;
      const farmApy = poolApr + poolApr * farmApr / 2;
      const stakeApy = farmApy + specApy;
      const apy = Math.max(compoundApy, stakeApy);

      const vault: Vault = {
        symbol: this.info.coinInfos[key],
        assetToken: key,
        pairStat,
        poolInfo: this.info.poolInfos[key],
        pairInfo: this.info.pairInfos[key],
        specApy,
        farmApy,
        compoundApy,
        stakeApy,
        apy,
      };
      this.allVaults.push(vault);
    }
    this.lastSortBy = undefined;
    this.refresh();
  }

  memoize(name: string) {
    if (name === 'deposit') {
      localStorage.setItem('deposit', `${this.showDepositedPoolOnly}`);
    }
  }

  @debounce(250)
  refresh() {
    let vaults = this.allVaults;
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

  private updateMyTvl() {
    const specPoolResponse = this.info.poolResponses[this.terrajs.settings.specToken];
    const mirPoolResponse = this.info.poolResponses[this.terrajs.settings.mirrorToken];
    let tvl = 0;
    for (const vault of this.allVaults) {
      const rewardInfo = this.info.rewardInfos[vault.assetToken];
      if (!rewardInfo) {
        continue;
      }
      const poolResponse = this.info.poolResponses[vault.assetToken];
      tvl += +this.lpBalancePipe.transform(rewardInfo.bond_amount, poolResponse) / CONFIG.UNIT || 0;
      tvl += +this.balancePipe.transform(rewardInfo.pending_spec_reward, specPoolResponse) / CONFIG.UNIT || 0;
      if (vault.poolInfo.farm === 'Mirror') {
        tvl += +this.balancePipe.transform(rewardInfo.pending_farm_reward, mirPoolResponse) / CONFIG.UNIT || 0;
      }
    }

    tvl += +this.balancePipe.transform(this.myStaked, specPoolResponse) / CONFIG.UNIT || 0;
    this.myTvl = tvl;
  }

  vaultId = (_: number, item: Vault) => item.symbol;
}
