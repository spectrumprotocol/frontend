import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import { TerrajsService } from '../terrajs.service';
import {
  FarmInfoService,
  PairStat,
  PoolInfo,
  PoolItem
} from './farm-info.service';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { toBase64 } from '../../libs/base64';
import { PoolResponse } from '../api/terraswap_pair/pool_response';
import { times } from '../../libs/math';
import { RewardInfoResponseItem } from '../api/nexus_nassets_psi_farm/reward_info_response';
import { NethPsiFarmService } from '../api/neth-psi-farm.service';
import { NethPsiStakingService } from '../api/neth-psi-staking.service';
import { BalancePipe } from '../../pipes/balance.pipe';
import { VaultsResponse } from '../api/gov/vaults_response';

@Injectable()
export class NethPsiFarmInfoService implements FarmInfoService {
  farm = 'Nexus';
  tokenSymbol = 'Psi';
  autoCompound = true;
  autoStake = true;
  farmColor = '#F4B6C7';
  pairSymbol = 'Psi';
  baseSymbol = 'nEth';

  constructor(
    private nethPsiFarmService: NethPsiFarmService,
    private terrajs: TerrajsService,
    private apollo: Apollo,
    private nethPsiStakingService: NethPsiStakingService,
    private balancePipe: BalancePipe
  ) { }

  get farmContract() {
    return this.terrajs.settings.nEthPsiFarm;
  }

  get farmTokenContract() {
    return this.terrajs.settings.nexusToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.nexusGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.nethPsiFarmService.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse): Promise<Record<string, PairStat>> {
    const apollo = this.apollo.use(this.terrajs.settings.nexusGraph);
    const nexusLPStatTask = apollo.query<any>({
      query: gql`{
        getLiquidityPoolApr {
          psiNEthLpArp
        }
      }`
    }).toPromise();
    const nexusGovStatTask = apollo.query<any>({
      query: gql`{
        getGovStakingAprRecords(limit: 1, offset: 0) {
          date
          govStakingApr
        }
      }`
    }).toPromise();

    const unixTimeSecond = Math.floor(Date.now() / 1000);
    const rewardInfoTask = this.nethPsiStakingService.query({ staker_info: { time_seconds: +unixTimeSecond, staker: this.terrajs.settings.nEthPsiFarm } });
    const farmConfigTask = this.nethPsiFarmService.query({ config: {} });

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.nEthPsiFarm)?.weight || 0;
    const nexusLPStat = await nexusLPStatTask;
    const nexusGovStat = await nexusGovStatTask;
    const pairs: Record<string, PairStat> = {};

    const rewardInfo = await rewardInfoTask;
    const farmConfig = await farmConfigTask;
    const communityFeeRate = +farmConfig.community_fee;
    const p = poolResponses[this.terrajs.settings.nEthToken];
    const psiAsset = p.assets.find(a => a.info.token?.['contract_addr'] === this.terrajs.settings.nexusToken);
    if (!psiAsset) {
      return;
    }
    const psiPrice = this.balancePipe.transform('1', poolResponses[this.terrajs.settings.nexusToken]);
    const totalPsiValueUST = times(psiPrice, psiAsset.amount);
    const nEthPsiTvl = new BigNumber(totalPsiValueUST)
      .times(rewardInfo.bond_amount)
      .times(2)
      .div(p.total_share)
      .toString();

    const poolApr = +(nexusLPStat.data.getLiquidityPoolApr.psiNEthLpArp || 0) / 100;
    pairs[this.terrajs.settings.nEthToken] = createPairStat(poolApr, this.terrajs.settings.nEthToken);
    const pair = pairs[this.terrajs.settings.nEthToken];
    pair.tvl = nEthPsiTvl;
    pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;

    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, token: string) {
      const poolInfo = poolInfos[token];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        farmApr: nexusGovStat.data.getGovStakingAprRecords[0].govStakingApr / 100,
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.nethPsiFarmService.query({
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  getStakeGovMsg(amount: string): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.nexusToken,
      {
        send: {
          contract: this.terrajs.settings.nexusGov,
          amount,
          msg: toBase64({ stake_voting_tokens: {} })
        }
      }
    );
  }
}
