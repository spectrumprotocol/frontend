import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { AnchorFarmService } from '../../api/anchor-farm.service';
import { AnchorStakingService } from '../../api/anchor-staking.service';
import {Decimal, PoolItem, Uint128} from '../../api/astroport_token_ust_farm/pools_response';
import { RewardInfoResponseItem } from '../../api/astroport_token_ust_farm/reward_info_response';
import { TerrajsService } from '../../terrajs.service';
import {
  DEX,
  FarmInfoService,
  FARM_TYPE_ENUM,
  PairStat,
  PoolInfo
} from '../farm-info.service';
import {MsgExecuteContract} from '@terra-money/terra.js';
import {toBase64} from '../../../libs/base64';
import {PoolResponse} from '../../api/terraswap_pair/pool_response';
import {HttpClient} from '@angular/common/http';
import {VaultsResponse} from '../../api/gov/vaults_response';
import {Denom} from '../../../consts/denom';

@Injectable()
export class MockAstroportAnchorFarmInfoService implements FarmInfoService {
  farm = 'Anchor';
  autoCompound = true;
  autoStake = true;
  farmColor = '#3bac3b';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Astroport';
  hasProxyReward = true;

  get defaultBaseTokenContractOrNative() {
    return this.terrajs.settings.anchorAstroportToken;
  }

  getDenomTokenContractOrNative(baseToken?: string): string{
    return Denom.USD;
  }

  constructor(
    private anchorFarm: AnchorFarmService,
    private terrajs: TerrajsService,
    private anchorStaking: AnchorStakingService,
    private httpClient: HttpClient,
  ) {
  }

  get farmContract() {
    return this.terrajs.settings.anchorFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.anchorAstroportToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.anchorGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    return [
      {
        asset_token: this.terrajs.settings.anchorAstroportToken,
        auto_spec_share_index: '0',
        farm_share: '0',
        farm_share_index: '0',
        farm2_share: '0',
        farm2_share_index: '0',
        stake_spec_share_index: '0',
        staking_token: '0',
        state_spec_share_index: '0',
        total_auto_bond_share: '0',
        total_stake_bond_amount: '0',
        total_stake_bond_share: '0',
        weight: 100,
      }
    ];
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse): Promise<Record<string, PairStat>> {
    const height = await this.terrajs.getHeight();
    const rewardInfoTask = this.anchorStaking.query({ staker_info: { block_height: +height, staker: this.terrajs.settings.anchorFarm } });
    const farmConfigTask = this.anchorFarm.query({ config: {} });
    const anchorStatTask = this.httpClient.get<any>(this.terrajs.settings.anchorAPI + '/ust-lp-reward').toPromise();
    const anchorGovTask = this.httpClient.get<any>(this.terrajs.settings.anchorAPI + '/gov-reward').toPromise();

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.anchorFarm)?.weight || 0;
    const anchorStat = await anchorStatTask;
    const anchorGov = await anchorGovTask;
    const pairs: Record<string, PairStat> = {};

    const poolApr = +(anchorStat?.apy || 0);
    const key = this.dex + '|' + this.terrajs.settings.anchorAstroportToken + '|' + this.getDenomTokenContractOrNative();
    pairs[key] = createPairStat(poolApr, key);

    const rewardInfo = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const communityFeeRate = +farmConfig.community_fee;
    const p = poolResponses[key];
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }
    const pair = pairs[key];
    const value = new BigNumber(uusd.amount)
      .times(rewardInfo.bond_amount)
      .times(2)
      .div(p.total_share)
      .toString();
    pair.tvl = value;
    pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;

    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, key: string) {
      const poolInfo = poolInfos[key];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        farmApr: +(anchorGov?.current_apy || 0),
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    return [
      {
        asset_token: this.terrajs.settings.anchorAstroportToken,
        auto_bond_amount: '1000000',
        auto_bond_share: '1000000',
        auto_spec_share_index: '1000000',
        bond_amount: '2000000',
        deposit_amount: '1500000',
        deposit_time: 1640617615,
        farm_share: '1000000',
        farm_share_index: '1000000',
        farm2_share: '1000000',
        farm2_share_index: '1000000',
        pending_farm_reward: '1000000',
        pending_farm2_reward: '1500000',
        pending_spec_reward: '1000000',
        spec_share: '1000000',
        stake_bond_amount: '1000000',
        stake_bond_share: '1000000',
        stake_spec_share_index: '1000000',
      }
    ];
  }

  getStakeGovMsg(amount: string): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.anchorAstroportToken,
      {
          send: {
            contract: this.terrajs.settings.anchorGov,
            amount,
            msg: toBase64({stake_voting_tokens: {}})
          }
      }
    );
  }
}
