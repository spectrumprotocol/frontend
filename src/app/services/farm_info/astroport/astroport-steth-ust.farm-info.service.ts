import {Injectable} from '@angular/core';
import BigNumber from 'bignumber.js';
import {PoolItem} from '../../api/astroport_token_ust_farm/pools_response';
import {RewardInfoResponseItem} from '../../api/astroport_token_ust_farm/reward_info_response';
import {TerrajsService} from '../../terrajs.service';
import {DEX, FARM_TYPE_ENUM, FarmInfoService, PairStat, PoolInfo} from './../farm-info.service';
import {MsgExecuteContract} from '@terra-money/terra.js';
import {PoolResponse} from '../../api/terraswap_pair/pool_response';
import {VaultsResponse} from '../../api/gov/vaults_response';
import {Denom} from '../../../consts/denom';
import {WasmService} from '../../api/wasm.service';
import {PairInfo} from '../../api/terraswap_factory/pair_info';
import {AstroportSttokenUstFarmService} from '../../api/astroport-sttokenust-farm.service';
import { TokenService } from '../../api/token.service';

@Injectable()
export class AstroportStethUstFarmInfoService implements FarmInfoService {
  farm = 'Lido';
  autoCompound = true;
  autoStake = false;
  farmColor = '#e59283';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Astroport';
  denomTokenContract = Denom.USD;
  highlight = false;
  mainnetOnly = true;
  hasProxyReward = true;

  constructor(
    private farmService: AstroportSttokenUstFarmService,
    private terrajs: TerrajsService,
    private token: TokenService,
  ) {
  }

  get defaultBaseTokenContract() {
    return this.terrajs.settings.stethToken;
  }

  get farmContract() {
    return this.terrajs.settings.astroportStethUstFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.ldoToken;
  }

  get farmGovContract() {
    return null;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.farmService.query(this.farmContract, {pools: {}});
    return pool.pools;
  }

  // no LP APR calculation, return 0 to use Astroport API
  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const key = `${this.dex}|${this.defaultBaseTokenContract}|${Denom.USD}`;
    const depositAmountTask = this.token.balance(pairInfos[key].liquidity_token, this.farmContract);
    const farmConfigTask = this.farmService.query(this.farmContract, {config: {}});

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
    const pairs: Record<string, PairStat> = {};

    const [depositAmount, farmConfig] = await Promise.all([depositAmountTask, farmConfigTask]);

    const communityFeeRate = +farmConfig.community_fee;
    const p = poolResponses[key];
    const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
    if (!uusd) {
      return;
    }

    const poolApr = 0;
    pairs[key] = createPairStat(poolApr, key);
    const pair = pairs[key];
    pair.tvl = new BigNumber(uusd.amount)
      .times(depositAmount.balance)
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
        poolAstroApr: 0,
        farmApr: 0,
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
    return null;
  }

  async getLPStat(poolResponse: PoolResponse, farmApr: number, astroPrice: number) {
    return null;
  }

}
