import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { WalletService } from 'src/app/services/api/wallet.service';
import { CONFIG } from '../../consts/config';
import { GovService } from '../../services/api/gov.service';
import { ConfigInfo } from '../../services/api/gov/config_info';
import { PollInfo, PollStatus } from '../../services/api/gov/polls_response';
import { TokenService } from '../../services/api/token.service';
import { InfoService } from '../../services/info.service';
import { TerrajsService } from '../../services/terrajs.service';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { GovPoolDetail } from './gov-pool/gov-pool.component';
import { div, gt, minus, plus, times } from 'src/app/libs/math';
import { BalanceResponse } from 'src/app/services/api/gov/balance_response';

const LIMIT = 10;

@Component({
  selector: 'app-gov',
  templateUrl: './gov.component.html',
  styleUrls: ['./gov.component.scss']
})
export class GovComponent implements OnInit, OnDestroy {
  poolDetails: GovPoolDetail[] = [];
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

  constructor(
    private gov: GovService,
    public info: InfoService,
    private terrajs: TerrajsService,
    private token: TokenService,
    private wallet: WalletService,
    protected $gaService: GoogleAnalyticsService
  ) { }

  ngOnInit() {
    this.$gaService.event('VIEW_GOV_PAGE');
    this.connected = this.terrajs.connected
      .subscribe(async connected => {
        const task1 = this.token.query(this.terrajs.settings.specToken, { token_info: {} });
        const task2 = this.wallet.balance(this.terrajs.settings.wallet, this.terrajs.settings.platform);
        Promise.all([task1, task2])
          .then(it => this.supply = +it[0].total_supply - +it[1].staked_amount - +it[1].unstaked_amount);
        this.gov.config()
          .then(it => this.config = it);
        this.info.refreshStat();
        this.info.refreshPool().then(() => {
          this.marketCap = this.supply / CONFIG.UNIT * Number(this.info.specPrice);
          this.fetchPoolDetails();
        });
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

  async fetchPoolDetails() {
    const [stateInfo, balanceResponse] = await Promise.all([
      this.gov.state(),
      this.terrajs.connected.value ? this.gov.balance() : Promise.resolve(null as BalanceResponse),
    ]);

    const vaultFeeByPools = {};
    let lockedBalance = '0';

    const vaultFeeSlice = this.info.stat.vaultFee / stateInfo.pools.length;
    for (let n = 0; n < stateInfo.pools.length; n++) {
      const involvedPools = stateInfo.pools.slice(n);
      const sumTotalBalance = involvedPools.reduce((sum, pool) => sum + +pool.total_balance, 0);

      for (const pool of involvedPools) {
        const poolVaultFee = +pool.total_balance / sumTotalBalance * vaultFeeSlice;
        vaultFeeByPools[pool.days] = (vaultFeeByPools[pool.days] || 0) + poolVaultFee;
      }
    }

    if (balanceResponse) {
      const mostLockedBalance = balanceResponse.locked_balance.reduce((c, [_, { balance }]) => Math.max(c, +balance), 0);
      lockedBalance = div(mostLockedBalance, CONFIG.UNIT);
    }

    this.poolDetails = stateInfo.pools
      .map((pool) => {
        const balanceInfo = balanceResponse?.pools.find(p => p.days === pool.days);
        const userBalance = div(balanceInfo?.balance ?? 0, CONFIG.UNIT)
        const unlockAt = balanceInfo?.unlock ? new Date(balanceInfo.unlock * 1000) : null;
        const poolTvl = +pool.total_balance * +this.info.specPrice;

        return {
          userBalance,
          unlockAt,
          days: pool.days,
          apr: vaultFeeByPools[pool.days] / poolTvl,
          balance: div(pool.total_balance, CONFIG.UNIT),
          userAvailableBalance: '0', // populate after this mapping
          moveOptions: [], // populate after this mapping
        };
      })
      .map((current, _, poolDetails) => {
        const sumOtherPoolsBalance = poolDetails.filter(d => d.days !== current.days)
          .reduce((sum, d) => plus(sum, d.userBalance), '0');

        const unreservedBalance = minus(lockedBalance, sumOtherPoolsBalance);
        const userAvailableBalance = gt(unreservedBalance, 0)
          ? minus(current.userBalance, unreservedBalance)
          : current.userBalance

        const moveOptions = poolDetails.filter(d => d.days > current.days)
          .map(({ days, userBalance, unlockAt }) => ({ days, userBalance, unlockAt }));

        return {
          ...current,
          userAvailableBalance,
          moveOptions,
        };
      });
  }

  trackPoolDetails(_: unknown, poolDetail: GovPoolDetail) {
    return poolDetail.days;
  }
}
