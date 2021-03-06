import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { TerrajsService } from '../terrajs.service';
import {
  DEX,
  FARM_TYPE_ENUM,
  FarmInfoService,
  PairStat,
  PoolInfo
} from './farm-info.service';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { toBase64 } from '../../libs/base64';
import { PoolResponse } from '../api/terraswap_pair/pool_response';
import { ValkyrieFarmService } from '../api/valkyrie-farm.service';
import { ValkyrieStakingService } from '../api/valkyrie-staking.service';
import { PoolItem } from '../api/valkyrie_farm/pools_response';
import { RewardInfoResponseItem } from '../api/valkyrie_farm/reward_info_response';
import { VaultsResponse } from '../api/gov/vaults_response';
import { Denom } from '../../consts/denom';
import {PairInfo} from '../api/terraswap_factory/pair_info';

@Injectable()
export class ValkyrieFarmInfoService implements FarmInfoService {
  farm = 'Valkyrie';
  autoCompound = true;
  autoStake = true;
  farmColor = '#ffe646';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Terraswap';
  denomTokenContract = Denom.USD;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.valkyrieToken;
  }

  constructor(
    private terrajs: TerrajsService,
    private valkyrieFarm: ValkyrieFarmService,
    private valkyrieStaking: ValkyrieStakingService,
  ) { }

  get farmContract() {
    return this.terrajs.settings.valkyrieFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.valkyrieToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.valkyrieGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.valkyrieFarm.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const rewardInfoTask = this.valkyrieStaking.query({ staker_info: { staker: this.terrajs.settings.valkyrieFarm } });
    const farmConfigTask = this.valkyrieFarm.query({ config: {} });
    // const valkyrieStatTask = this.httpClient.get<any>(this.terrajs.settings.valkyrieAPI + '/liquidity-provision/stake/apr').toPromise();
    // const valkyrieGovTask = this.httpClient.get<any>(this.terrajs.settings.valkyrieAPI + '/governance/stake/apr').toPromise();

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.valkyrieFarm)?.weight || 0;
    // const valkyrieStat = await valkyrieStatTask;
    // const valkyrieGov = await valkyrieGovTask;
    const pairs: Record<string, PairStat> = {};

    // const poolApr = +(valkyrieStat?.data?.apr || 0);
    const poolApr = 0;
    const key = `${this.dex}|${this.terrajs.settings.valkyrieToken}|${Denom.USD}`;
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
        // poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        // farmApr: +(valkyrieGov?.data?.apr || 0),
        poolApy: 0,
        farmApr: 0,
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.valkyrieFarm.query({
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  getStakeGovMsg(amount: string): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.valkyrieToken,
      {
        send: {
          contract: this.terrajs.settings.valkyrieGov,
          amount,
          msg: toBase64({ stake_governance_token: {} })
        }
      }
    );
  }
}
