import {Injectable} from '@angular/core';
import BigNumber from 'bignumber.js';
import {PoolItem} from '../../api/astroport_token_ust_farm/pools_response';
import {RewardInfoResponseItem} from '../../api/astroport_token_ust_farm/reward_info_response';
import {TerrajsService} from '../../terrajs.service';
import {DEX, FARM_TYPE_ENUM, FarmInfoService, PairStat, PoolInfo} from './../farm-info.service';
import {MsgExecuteContract} from '@terra-money/terra.js';
import {toBase64} from '../../../libs/base64';
import {PoolResponse} from '../../api/terraswap_pair/pool_response';
import {VaultsResponse} from '../../api/gov/vaults_response';
import {Denom} from '../../../consts/denom';
import {AstroportTokenUstFarmService} from '../../api/astroport-tokenust-farm.service';
import {WasmService} from '../../api/wasm.service';
import {PairInfo} from '../../api/terraswap_factory/pair_info';
import {Apollo, gql} from 'apollo-angular';

@Injectable()
export class AstroportPsiUstFarmInfoService implements FarmInfoService {
  farm = 'Nexus';
  autoCompound = true;
  autoStake = true;
  farmColor = '#F4B6C7';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Astroport';
  denomTokenContract = Denom.USD;
  highlight = false;
  mainnetOnly = false;
  hasProxyReward = true;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.nexusToken;
  }

  constructor(
    private farmService: AstroportTokenUstFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService,
    private apollo: Apollo,
  ) {
  }

  get farmContract() {
    return this.terrajs.settings.astroportPsiUstFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.nexusToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.nexusGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.farmService.query(this.farmContract, {pools: {}});
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const key = `${this.dex}|${this.defaultBaseTokenContract}|${Denom.USD}`;
    const depositAmountTask = this.wasm.query(this.terrajs.settings.astroportGenerator, {
      deposit: {
        lp_token: pairInfos[key].liquidity_token,
        user: this.farmContract
      }
    });
    const farmConfigTask = this.farmService.query(this.farmContract, {config: {}});
    // const apollo = this.apollo.use(this.terrajs.settings.nexusGraph);
    // const nexusGovStatTask = apollo.query<any>({
    //   query: gql`{
    //     getGovStakingApyRecords(limit: 1, offset: 0) {
    //       date
    //       govStakingApy
    //     }
    //   }`
    // }).toPromise();

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
    const lpStatTask = this.getLPStat(poolResponses[key]);
    const govStatTask = this.getGovStat();
    const pairs: Record<string, PairStat> = {};

    // const [depositAmount, farmConfig, lpStat, nexusGovStat] = await Promise.all([depositAmountTask, farmConfigTask, lpStatTask, nexusGovStatTask]);
    const [depositAmount, farmConfig, lpStat] = await Promise.all([depositAmountTask, farmConfigTask, lpStatTask]);
    const communityFeeRate = +farmConfig.community_fee;
    const p = poolResponses[key];
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }

    const poolApr = +(lpStat.apr || 0);
    pairs[key] = createPairStat(poolApr, key);
    const pair = pairs[key];
    pair.tvl = new BigNumber(uusd.amount)
      .times(depositAmount)
      .times(2)
      .div(p.total_share)
      .toString();
    pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;

    return pairs;

    // tslint:disable-next-line:no-shadowed-variable
    function createPairStat(poolApr: number, key: string) {
      const poolInfo = poolInfos[key];
      const stat: PairStat = {
        poolApr,
        poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
        farmApr: 0,
        // nexusGovStat.data.getGovStakingApyRecords[0].govStakingApy / 100,
        tvl: '0',
        multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
        vaultFee: 0,
      };
      return stat;
    }
  }

  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.farmService.query(this.farmContract, {
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
          msg: toBase64({stake_voting_tokens: {}})
        }
      }
    );
  }

  async getLPStat(poolResponse: PoolResponse) {
    return {
      apr: 0
    };
  }

  async getGovStat() {
    return {
      apy: 0
    };
  }
}
