import { Injectable } from '@angular/core';
import { PoolItem } from '../api/pylon_liquid_farm/pools_response';
import { RewardInfoResponseItem } from '../api/pylon_farm/reward_info_response';
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
import { BPsiDpFarmService } from '../api/bpsidp-farm.service';
import { WasmService } from '../api/wasm.service';
import { VaultsResponse } from '../api/gov/vaults_response';
import { div } from '../../libs/math';
import { Apollo, gql } from 'apollo-angular';
import { Denom } from '../../consts/denom';
import {PairInfo} from '../api/terraswap_factory/pair_info';

@Injectable()
export class BPsiDPFarmInfoService implements FarmInfoService {
  farm = 'Pylon';
  autoCompound = true;
  autoStake = true;
  farmColor = '#00cfda';
  farmType: FARM_TYPE_ENUM = 'PYLON_LIQUID';
  auditWarning = false;
  dex: DEX = 'Terraswap';
  mainnetOnly = true;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.bPsiDPToken;
  }

  // not actually denom, but for construct trade pair
  get denomTokenContract() {
    return this.terrajs.settings.nexusToken;
  }

  constructor(
    private bPsiDpFarmService: BPsiDpFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService,
    private apollo: Apollo,
  ) { }

  get farmContract() {
    return this.terrajs.settings.bPsiDPFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.nexusToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.nexusGov;
  }

  get pylonLiquidInfo() {
    return {
      dpPool: this.terrajs.settings.psiDPGatewayPool,
      dpToken: this.terrajs.settings.psiDPToken,
      bdpPool: this.terrajs.settings.bPsiDPGatewayPool,
      bdpToken: this.terrajs.settings.bPsiDPToken,
    };
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.bPsiDpFarmService.query({ pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const farmConfigTask = this.bPsiDpFarmService.query({ config: {} });
    const balanceOfTask = this.wasm.query(this.terrajs.settings.bPsiDPGatewayPool, { balance_of: { owner: this.terrajs.settings.bPsiDPFarm } });
    const apollo = this.apollo.use(this.terrajs.settings.nexusGraph);
    const nexusGovStatTask = apollo.query<any>({
      query: gql`{
        getGovStakingAprRecords(limit: 1, offset: 0) {
          date
          govStakingApr
        }
      }`
    }).toPromise();

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.bPsiDPFarm)?.weight || 0;
    const bPsiDPStat = await this.getBPsiDPStat(poolResponses);
    const pairs: Record<string, PairStat> = {};

    const [farmConfig, nexusGovStat] = await Promise.all([farmConfigTask, nexusGovStatTask]);
    const communityFeeRate = +farmConfig.community_fee;
    const specbPsiDPTvl = (await balanceOfTask)?.amount || '0';

    const poolApr = +(bPsiDPStat.apr || 0);
    const key = `${this.defaultBaseTokenContract}`;
    pairs[key] = createPairStat(poolApr, key);
    const pair = pairs[key];
    pair.tvl = specbPsiDPTvl;
    pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;

    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, key: string) {
      const poolInfo = poolInfos[key];
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

  async getBPsiDPStat(poolResponses: Record<string, PoolResponse>) {
    const configInfoTask = this.wasm.query(this.terrajs.settings.bPsiDPGatewayPool, { config: {} });
    const rewardInfoTask = this.wasm.query(this.terrajs.settings.bPsiDPGatewayPool, { reward: {} });
    const [configInfo, rewardInfo] = await Promise.all([configInfoTask, rewardInfoTask]);

    const psiPool = poolResponses[`Astroport|${this.terrajs.settings.nexusToken}|${Denom.USD}`];
    const [psi, ust] = psiPool.assets[0].info.token?.['contract_addr'] === this.terrajs.settings.nexusToken
      ? [psiPool.assets[0].amount, psiPool.assets[1].amount]
      : [psiPool.assets[1].amount, psiPool.assets[0].amount];
    const psiPrice = div(ust, psi);

    const rewardRate = Number(div(configInfo.distribution_config.reward_rate, 1000000)).toFixed(15);
    const totalDeposit = div(+rewardInfo.total_deposit, 1000000);
    const apr = 365 * (+rewardRate * +psiPrice * 86400 / +totalDeposit);
    return {
      apr,
    };
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.bPsiDpFarmService.query({
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
