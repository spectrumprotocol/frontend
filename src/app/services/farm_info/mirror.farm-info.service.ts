import {Injectable} from '@angular/core';
import {Apollo, gql} from 'apollo-angular';
import BigNumber from 'bignumber.js';
import {MirrorFarmService} from '../api/mirror-farm.service';
import {MirrorStakingService} from '../api/mirror-staking.service';
import {RewardInfoResponseItem} from '../api/mirror_farm/reward_info_response';
import {TerrajsService} from '../terrajs.service';
import {DEX, FARM_TYPE_ENUM, FarmInfoService, PairStat, PoolInfo, PoolItem} from './farm-info.service';
import {MsgExecuteContract} from '@terra-money/terra.js';
import {toBase64} from '../../libs/base64';
import {PoolResponse} from '../api/terraswap_pair/pool_response';
import {VaultsResponse} from '../api/gov/vaults_response';
import {Denom} from '../../consts/denom';
import {PairInfo} from '../api/terraswap_factory/pair_info';
import { HttpClient } from '@angular/common/http';
import { assetsAPRQuery } from '../apr/apr';
import { listed } from '../apr/data';
import { StakingPool } from '../apr/type';
import { WasmService } from '../api/wasm.service';

const num = (number: BigNumber.Value) => new BigNumber(number)

@Injectable()
export class MirrorFarmInfoService implements FarmInfoService {

  farm = 'Mirror';
  autoCompound = true;
  autoStake = true;
  farmColor = '#232C45';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Terraswap';
  denomTokenContract = Denom.USD;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.mirrorToken;
  }

  constructor(
    private mirrorFarm: MirrorFarmService,
    private mirrorStaking: MirrorStakingService,
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) {
  }

  get farmContract() {
    return this.terrajs.settings.mirrorFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.mirrorToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.mirrorGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const res = await this.mirrorFarm.query({pools: {}});
    return res.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    // fire query
    const rewardInfoTask = this.mirrorStaking.query({
      reward_info: {
        staker_addr: this.terrajs.settings.mirrorFarm
      }
    });
    const farmConfigTask = this.mirrorFarm.query({config: {}});
    // const apollo = this.apollo.use(this.terrajs.settings.mirrorGraph);
    // const mirrorGovStatTask = apollo.query<any>({
    //   query: gql`query statistic($network: Network) {
    //     statistic(network: $network) {
    //       govAPR
    //     }
    //   }`,
    //   variables: {
    //     network: 'TERRA'
    //   }
    // }).toPromise();

    // const mirrorStat = await apollo.query<any>({
    //   query: gql`query assets {
    //     assets {
    //       token
    //       statistic {
    //         apr { long }
    //       }
    //     }
    //   }`
    // }).toPromise();
    const annualRewards = await this.getAnnualRewardsQuery();
    const stakingPoolInfoAssets = await this.getStakingPoolInfoAssets(listed);;
    const mirrorApr = assetsAPRQuery(this.terrajs, poolResponses, annualRewards, stakingPoolInfoAssets);

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.mirrorFarm)?.weight || 0;
    // const mirrorGovStat = await mirrorGovStatTask;
    const pairs: Record<string, PairStat> = {};
    const mirrorStat = Object.keys(mirrorApr).map((key) => ({token: key, apr: {...mirrorApr[key]}}));
    for (const asset of mirrorStat) {
      const poolApr = asset.token === this.terrajs.settings.mirrorToken ? 0 : (+asset.apr?.long || 0);
      const key = `${this.dex}|${asset.token}|${this.denomTokenContract}`;
      pairs[key] = createPairStat(poolApr, key);
    }

    const rewardInfos = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const communityFeeRate = +farmConfig.community_fee;
    const tasks = rewardInfos.reward_infos.map(async it => {
      const key = `${this.dex}|${it.asset_token}|${this.denomTokenContract}`;
      const p = poolResponses[key];
      const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
      if (!uusd) {
        return;
      }
      const pair = (pairs[key] || (pairs[key] = createPairStat(0, key)));
      const value = new BigNumber(uusd.amount)
        .times(it.bond_amount)
        .times(2)
        .div(p.total_share)
        .toString();
      
      pair.tvl = value;
      pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;
    });
    await Promise.all(tasks);
    return pairs;

    function createPairStat(poolApr: number, key: string) {
      const poolInfo = poolInfos[key];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        farmApr: 0,
        // mirrorGovStat.data.statistic.govAPR,
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.mirrorFarm.query({
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  getStakeGovMsg(amount: string): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.mirrorToken,
      {
        send: {
          contract: this.terrajs.settings.mirrorGov,
          amount,
          msg: toBase64({stake_voting_tokens: {}})
        }
      }
    );
  }

  getStakingPoolInfoAssets = async (listed: Array<any>): Promise<Record<string, StakingPool>> => {
    let stakingPoolInfoAssets = {};
    for(let { token } of listed) {
      const stakingPoolInfo = await this.mirrorStaking.query({
        pool_info: {
          asset_token: token
        }
      });
      stakingPoolInfoAssets[token] = stakingPoolInfo;
    };
    return stakingPoolInfoAssets;
  }

  getAnnualRewardsQuery = async (): Promise<Record<string, String>> => {

    // got from apr.ts in Mirror dApp FE
    // genesis(2020-12-04 04:00 KST) + 6hours
    const START = 1607022000000 + 60000 * 60 * 6;
    const YEAR = 60000 * 60 * 24 * 365;
  
    const distributionSchedules = [
      [START, YEAR * 1 + START, '54900000000000'],
      [YEAR * 1 + START, YEAR * 2 + START, '27450000000000'],
      [YEAR * 2 + START, YEAR * 3 + START, '13725000000000'],
      [YEAR * 3 + START, YEAR * 4 + START, '6862500000000'],
    ];
  
    const now = Date.now();
    const schedule = distributionSchedules.find(
      (item) => now >= item[0] && now <= item[1]
    );
    const reward = Array.isArray(schedule) ? schedule[2] : "0"
  
    const distributionInfo = await this.wasm.query(this.terrajs.settings.mirrorFactory, { distribution_info: {} });
    const weights = distributionInfo?.weights;
  
    if (reward === "0" || !weights) {
      return {}
    }
  
    const totalWeight = weights.reduce((acc, cur) => acc.plus(cur[1]), num(0))
  
    const getTokenReward = (weight: number) =>
      num(reward).multipliedBy(num(weight).dividedBy(totalWeight))
  
    return weights
      .filter(([, weight]) => num(weight).isGreaterThan(0))
      .reduce(
        (acc, cur) =>
          Object.assign(acc, {
            [cur[0]]: getTokenReward(cur[1]).toFixed(0),
          }),
        {}
      )
  }
}
