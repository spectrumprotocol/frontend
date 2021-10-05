import { Component, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { forkJoin, of, Subscription } from 'rxjs';
import { WalletService } from 'src/app/services/api/wallet.service';
import { CONFIG } from '../../consts/config';
import { GovService } from '../../services/api/gov.service';
import { ConfigInfo } from '../../services/api/gov/config_info';
import { PollInfo, PollStatus } from '../../services/api/gov/polls_response';
import { TokenService } from '../../services/api/token.service';
import { InfoService } from '../../services/info.service';
import { TerrajsService } from '../../services/terrajs.service';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { GovernanceService } from 'src/app/services/governanace.service';
import { GovPoolComponent, GovPoolDetail, GovPoolTab } from './gov-pool/gov-pool.component';

const LIMIT = 10;

@Component({
  selector: 'app-gov',
  templateUrl: './gov.component.html',
  styleUrls: ['./gov.component.scss']
})
export class GovComponent implements OnInit, OnDestroy {
  isWalletConnected = false;
  poolDetails: GovPoolDetail[] = [];
  walletBalance: bigint = BigInt(0);
  polls: PollInfo[] = [];
  hasMore = false;
  config: ConfigInfo;
  supply = 0;
  marketCap = 0;
  myStaked = 0;
  myPendingReward = 0;
  filteredStatus = '' as PollStatus;
  UNIT = CONFIG.UNIT;
  private connected: Subscription;

  @ViewChildren(GovPoolComponent) private poolComponents: QueryList<GovPoolComponent>;

  constructor(
    private gov: GovService,
    public info: InfoService,
    private terrajs: TerrajsService,
    private token: TokenService,
    private wallet: WalletService,
    protected $gaService: GoogleAnalyticsService,
    private governanceService: GovernanceService
  ) { }

  ngOnInit() {
    this.$gaService.event('VIEW_GOV_PAGE');
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        this.isWalletConnected = connected;
        const task1 = this.token.query(this.terrajs.settings.specToken, { token_info: {} });
        const task2 = this.wallet.balance(this.terrajs.settings.wallet, this.terrajs.settings.platform);
        Promise.all([task1, task2])
          .then(it => this.supply = +it[0].total_supply - +it[1].staked_amount - +it[1].unstaked_amount);
        this.gov.config()
          .then(it => this.config = it);
        this.info.refreshStat().then(() => {
          this.marketCap = this.supply / CONFIG.UNIT * Number(this.info.specPrice);
          this.fetchPoolDetails();
        });
        this.updateWalletBalance();
        this.pollReset();
        if (connected) {
          this.gov.balance()
            .then(it => this.myStaked = +it.balance);
          this.info.updateVaults();
          await this.info.initializeVaultData(connected);
          await this.info.updateMyTvl();
        }
      });
  }

  ngOnDestroy() {
    this.connected.unsubscribe();
  }

  async pollReset() {
    const res = await this.gov.query({
      polls: {
        filter: this.filteredStatus || undefined,
        limit: LIMIT
      }
    });
    this.polls = res.polls;
    this.hasMore = res.polls.length >= LIMIT;
  }

  async pollMore() {
    const res = await this.gov.query({
      polls: {
        filter: this.filteredStatus || undefined,
        limit: LIMIT,
        start_after: this.polls[this.polls.length - 1].id,
      }
    });
    this.polls.push(...res.polls);
    this.hasMore = res.polls.length >= LIMIT;
    this.$gaService.event('VIEW_GOV_PAGE', 'LOAD_MORE_POLL');
  }

  fetchPoolDetails() {
    forkJoin([
      this.governanceService.getState(),
      this.isWalletConnected ? this.governanceService.getBalance() : of(null),
    ]).subscribe(([stateInfo, balanceResponse]) => {
      const pools = stateInfo.pools.sort((a, b) => a.days - b.days);
      const vaultFeeByPools = {};

      Array(pools.length)
        .fill(this.info.stat.vaultFee / pools.length)
        .forEach((vaultFee, index) => {
          const involvedPools = pools.slice(index);
          const sumTotalBalance = involvedPools.reduce((sum, pool) => sum += Number(pool.total_balance), 0);

          involvedPools.forEach((pool) => {
            const poolVaultFee = Number(pool.total_balance) / sumTotalBalance * vaultFee;
            vaultFeeByPools[pool.days] = (vaultFeeByPools[pool.days] || 0) + poolVaultFee;
          });
        });

      this.poolDetails = pools
        .map((pool) => {
          const balanceInfo = balanceResponse?.pools.find(p => p.days === pool.days);
          const userBalance = BigInt(balanceInfo?.balance ?? 0);
          const unlock = balanceInfo?.unlock ?? 0;
          const poolTvl = Number(pool.total_balance) * Number(this.info.specPrice);

          return {
            userBalance,
            unlock,
            days: pool.days,
            apr: vaultFeeByPools[pool.days] / poolTvl,
            balance: BigInt(pool.total_balance),
            moveOptions: [],
          };
        })
        .map((detail, _, details) => ({
          ...detail,
          moveOptions: details.filter(d => d.days > detail.days)
            .map(({ days, userBalance, unlock }) => ({ days, userBalance, unlock })),
        }));
    });
  }

  updateWalletBalance() {
    if (this.info.userSpecAmount) {
      this.walletBalance = BigInt(this.info.userSpecAmount.replace('.', ''));
    }
  }

  resetPoolComponents() {
    this.poolComponents.forEach((poolCompoment) => { poolCompoment.reset(); });
  }

  deposit(amount: bigint, days: number) {
    this.governanceService.deposit(amount, days).subscribe(() => {
      this.fetchPoolDetails();
      this.updateWalletBalance();
      this.resetPoolComponents();
    });
  }

  withdraw(amount: bigint, days: number) {
    this.governanceService.withdraw(amount, days).subscribe(() => {
      this.fetchPoolDetails();
      this.updateWalletBalance();
      this.resetPoolComponents();
    });
  }

  move(amount: bigint, fromDays: number, toDays: number) {
    this.governanceService.move(amount, fromDays, toDays).subscribe(() => {
      this.fetchPoolDetails();
      this.updateWalletBalance();
      this.resetPoolComponents();
    });
  }

  onPoolTabChange(tab: GovPoolTab) {
    if (tab === GovPoolTab.Deposit) {
      this.updateWalletBalance();
    }
  }

  trackPoolDetails(_: unknown, poolDetail: GovPoolDetail) {
    return poolDetail.days;
  }
}
