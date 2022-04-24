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
import {getStablePrice} from '../../../libs/stable';
import {balance_transform} from '../../calc/balance_calc';
import {AstroportStlunaLunaFarmService} from '../../api/astroport-stlunaluna-farm.service';

@Injectable()
export class AstroportStlunaLunaFarmInfoService implements FarmInfoService {
  farm = 'Lido';
  autoCompound = true;
  autoStake = false;
  farmColor = '#e59283';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Astroport';
  denomTokenContract = Denom.LUNA;
  highlight = true;
  mainnetOnly = true;
  hasProxyReward = true;

  constructor(
    private farmService: AstroportStlunaLunaFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService,
  ) {
  }

  get defaultBaseTokenContract() {
    return this.terrajs.settings.stlunaToken;
  }

  get farmContract() {
    return this.terrajs.settings.astroportStlunaLunaFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.ldoToken;
  }

  get farmGovContract() {
    return null;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.farmService.query({pools: {}});
    return pool.pools;
  }

  // no LP APR calculation, return 0 to use Astroport API
  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const key = `${this.dex}|${this.defaultBaseTokenContract}|${this.denomTokenContract}`;
    const depositAmountTask = this.wasm.query(this.terrajs.settings.astroportGenerator, {
      deposit: {
        lp_token: pairInfos[key].liquidity_token,
        user: this.farmContract
      }
    });
    const farmConfigTask = this.farmService.query({config: {}});

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
    const pairs: Record<string, PairStat> = {};

    const [depositAmount, farmConfig] = await Promise.all([depositAmountTask, farmConfigTask]);

    const communityFeeRate = +farmConfig.community_fee;
    const stlunaLunaPoolResponses = poolResponses[key];
    const [ulunaAsset, stluna] = stlunaLunaPoolResponses.assets[0].info.native_token?.['denom'] === Denom.LUNA
      ? [stlunaLunaPoolResponses.assets[0], stlunaLunaPoolResponses.assets[1]]
      : [stlunaLunaPoolResponses.assets[1], stlunaLunaPoolResponses.assets[0]];
    if (!ulunaAsset) {
      return;
    }
    const ulunaPrice = balance_transform('1', poolResponses[`${this.dex}|${Denom.LUNA}|${Denom.USD}`]);
    const stlunaPriceInLuna = getStablePrice(+stluna.amount, +ulunaAsset.amount);

    const stlunaSwap = new BigNumber(depositAmount)
      .times(stluna.amount)
      .div(stlunaLunaPoolResponses.total_share)
      .times(stlunaPriceInLuna)
      .integerValue(BigNumber.ROUND_DOWN);

    const poolApr = 0;
    pairs[key] = createPairStat(poolApr, key);
    const pair = pairs[key];
    pair.tvl = new BigNumber(depositAmount)
      .times(ulunaAsset.amount)
      .div(stlunaLunaPoolResponses.total_share)
      .plus(stlunaSwap)
      .times(ulunaPrice)
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
    const rewardInfo = await this.farmService.query({
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
