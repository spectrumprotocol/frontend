import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CONFIG } from '../../consts/config';
import { GovService } from '../../services/api/gov.service';
import { ConfigInfo } from '../../services/api/gov/config_info';
import { PollInfo, PollStatus } from '../../services/api/gov/polls_response';
import { InfoService } from '../../services/info.service';
import { TerrajsService } from '../../services/terrajs.service';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { GovPoolDetail } from './gov-pool/gov-pool.component';
import { div, gt, minus, plus, times } from '../../libs/math';
import { BalanceResponse } from '../../services/api/gov/balance_response';
import { StateInfo } from '../../services/api/gov/state_info';
import { AnchorMarketService } from 'src/app/services/api/anchor-market.service';
import { HttpClient } from '@angular/common/http';

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
  myPendingReward = 0;
  stakedInGovAPR = 0;
  filteredStatus = '' as PollStatus;
  stateInfo: StateInfo;
  myBalance: BalanceResponse;
  UNIT = CONFIG.UNIT;
  private connected: Subscription;

  constructor(
    private gov: GovService,
    public info: InfoService,
    private terrajs: TerrajsService,
    private anchorMarket: AnchorMarketService,
    private httpClient: HttpClient,
    protected $gaService: GoogleAnalyticsService
  ) { }

  ngOnInit() {
    this.$gaService.event('VIEW_GOV_PAGE');
    this.connected = this.terrajs.connected
      .subscribe(async _ => {
        this.fetchPoolDetails();
        this.gov.config()
          .then(it => this.config = it);
        this.pollReset();
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
    const [state, rates] = await Promise.all([
      this.anchorMarket.query({ epoch_state: {} }),
      this.httpClient.get<any>(this.terrajs.settings.anchorAPI + '/deposit-rate').toPromise().catch(_ => undefined),
      this.gov.state().then(it => this.stateInfo = it),
      this.terrajs.isConnected
        ? this.gov.balance().then(it => this.myBalance = it)
        : Promise.resolve(null as BalanceResponse),
      this.info.retrieveCachedStat(),
      this.info.refreshPool(),
    ]);

    const anchorRatePerBlock = rates?.[0]?.deposit_rate ?? '0.000000041729682765';
    const anchorRatePerYear = times(anchorRatePerBlock, 4656810);

    const vaultFeeByPools = {};
    let lockedBalance = '0';

    const vaultFeeSlice = this.info.stat.vaultFee / this.stateInfo.pools.length;
    for (let n = 0; n < this.stateInfo.pools.length; n++) {
      const involvedPools = this.stateInfo.pools.slice(n);
      const sumTotalBalance = involvedPools.reduce((sum, pool) => sum + +pool.total_balance, 0);

      for (const pool of involvedPools) {
        const poolVaultFee = +pool.total_balance / sumTotalBalance * vaultFeeSlice;
        vaultFeeByPools[pool.days] = (vaultFeeByPools[pool.days] || 0) + poolVaultFee;
      }
    }

    if (this.myBalance) {
      const mostLockedBalance = this.myBalance.locked_balance.reduce((c, [_, { balance }]) => Math.max(c, +balance), 0);
      lockedBalance = div(mostLockedBalance, CONFIG.UNIT);
    }

    this.poolDetails = this.stateInfo.pools
      .map((pool) => {
        const balanceInfo = this.myBalance?.pools.find(p => p.days === pool.days);
        const userBalance = div(balanceInfo?.balance ?? 0, CONFIG.UNIT);
        const userProfit = times(div(balanceInfo?.pending_aust ?? 0, CONFIG.UNIT), state.exchange_rate);
        const unlockAt = balanceInfo?.unlock ? new Date(balanceInfo.unlock * 1000) : null;
        const poolTvl = +pool.total_balance * +this.info.specPrice;
        const apr = vaultFeeByPools[pool.days] / poolTvl;

        return {
          userBalance,
          userProfit,
          unlockAt,
          days: pool.days,
          apr: apr, // + apr * +anchorRatePerYear / 2,
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
          : current.userBalance;

        const moveOptions = poolDetails.filter(d => d.days > current.days)
          .map(({ days, userBalance, unlockAt }) => ({ days, userBalance, unlockAt }));

        return {
          ...current,
          userAvailableBalance,
          moveOptions,
        };
      });

    this.calculateAPR();
  }

  calculateAPR() {
    let sumGovAPR = 0;
    let totalStaked = 0;
    for (const pool of this.poolDetails) {
      sumGovAPR += +pool.userBalance * pool.apr;
      totalStaked += +pool.userBalance;
    }

    this.stakedInGovAPR = sumGovAPR / totalStaked;
  }

  trackPoolDetails(_: unknown, poolDetail: GovPoolDetail) {
    return poolDetail.days;
  }
}
