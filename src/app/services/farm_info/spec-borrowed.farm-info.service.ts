import {Injectable} from '@angular/core';
import {Denom} from 'src/app/consts/denom';
import {plus, times} from 'src/app/libs/math';
import {GovService} from '../api/gov.service';
import {VaultsResponse} from '../api/gov/vaults_response';
import {SpecBorrowedFarmService} from '../api/spec-borrowed-farm.service';
import {PairInfo} from '../api/terraswap_factory/pair_info';
import {PoolResponse} from '../api/terraswap_pair/pool_response';
import {TerrajsService} from '../terrajs.service';
import {FarmInfoService, PairStat, PoolInfo, PoolItem, RewardInfoResponseItem} from './farm-info.service';
import {WasmService} from '../api/wasm.service';
import BigNumber from 'bignumber.js';

@Injectable()
export class SpecBorrowedFarmInfoService implements FarmInfoService {
  farm = 'Spectrum';
  autoCompound = true;
  autoStake = false;
  farmColor = '#fc5185';
  auditWarning = false;
  farmType = 'BORROWED' as const;
  dex = 'Terraswap' as const;
  govLock = false;
  highlight = false;

  constructor(
    private terrajs: TerrajsService,
    private borrowedFarmService: SpecBorrowedFarmService,
    private gov: GovService,
    private wasm: WasmService
  ) {
  }

  get farmContract() {
    return this.terrajs.settings.specBorrowedFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.specToken;
  }

  get denomTokenContract() {
    return Denom.USD;
  }

  get defaultBaseTokenContract() {
    return this.terrajs.settings.specToken;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const config = await this.borrowedFarmService.query({config: {}});
    console.log(config);
    const poolItems: PoolItem[] = [{
      asset_token: this.defaultBaseTokenContract,
      spec_share_index: '0',
      staking_token: null,
      state_spec_share_index: '0',
      total_bond_amount: '0',
      weight: 0,
    }];
    return poolItems;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const leverageFarmPositionTask = this.wasm.query(this.terrajs.settings.specLeveragedFarm, {
      position: {
        user: this.farmContract
      }
    });
    const [leverageFarmPosition] = await Promise.all([leverageFarmPositionTask]);
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
    const depositAmount = leverageFarmPosition[0]?.bond_amount || '0';
    const pairs: Record<string, PairStat> = {};
    const key = `${this.dex}|${this.defaultBaseTokenContract}|${this.denomTokenContract}-${this.farmType}`;
    const p = poolResponses[key.split('-')[0]];
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }

    const poolApr = 0; //TODO and there is no poolAPY
    pairs[key] = createPairStat(poolApr, key);
    const pair = pairs[key];
    pair.tvl = new BigNumber(uusd.amount)
      .times(depositAmount)
      .times(2)
      .div(p.total_share)
      .toString();
    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, key: string) {
      const poolInfo = poolInfos[key];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        poolAstroApr: 0,
        farmApr: 0,
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0, // vaultFee is already applied in normal spec farm, except spec compound farm
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.borrowedFarmService.query({
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  async getCustomPoolInfos(): Promise<Omit<PoolInfo, 'key'>[]> {
    return [
      {
        farm: this.farm,
        farmContract: this.farmContract,
        baseTokenContract: this.defaultBaseTokenContract,
        denomTokenContract: this.denomTokenContract,
        rewardTokenContract: this.rewardTokenContract,
        rewardKey: `${this.dex}|${this.rewardTokenContract}|${Denom.USD}`,
        auto_compound: this.autoCompound,
        auto_stake: this.autoStake,
        govLock: this.govLock ?? false,
        forceDepositType: 'compound',
        auditWarning: this.auditWarning,
        farmType: this.farmType,
        score: this.highlight ? 1000000 : 0,
        dex: this.dex,
        highlight: this.highlight ?? false,
        hasProxyReward: false,

        // need to clean up interface
        asset_token: this.defaultBaseTokenContract,
        spec_share_index: '0',
        staking_token: '',
        state_spec_share_index: '0',
        total_bond_amount: '0',
        weight: 0,
      } as const
    ];
  }

  async getUserCredit(): Promise<string> {
    const config = await this.borrowedFarmService.query({config: {}});
    const balance = await this.gov.balance();

    return balance.pools?.reduce((sum, pool) => {
      const credit = config.gov.credits.find(c => c.days === pool.days);
      const multiplier = +credit?.credit || 0;

      return plus(sum, times(pool.balance, multiplier));
    }, '0');
  }
}
