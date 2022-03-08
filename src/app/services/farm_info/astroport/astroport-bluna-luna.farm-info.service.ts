import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { PoolItem } from '../../api/astroport_luna_ust_farm/pools_response';
import { RewardInfoResponseItem } from '../../api/astroport_luna_ust_farm/reward_info_response';
import { TerrajsService } from '../../terrajs.service';
import {
  DEX,
  FarmInfoService,
  FARM_TYPE_ENUM,
  PairStat,
  PoolInfo
} from './../farm-info.service';
import {MsgExecuteContract} from '@terra-money/terra.js';
import {toBase64} from '../../../libs/base64';
import {PoolResponse} from '../../api/terraswap_pair/pool_response';
import {VaultsResponse} from '../../api/gov/vaults_response';
import {Denom} from '../../../consts/denom';
import {times} from '../../../libs/math';
import {AstroportBlunalunaFarmService} from '../../api/astroport-blunaluna-farm.service';
import {PairInfo} from '../../api/terraswap_factory/pair_info';
import {WasmService} from '../../api/wasm.service';
import {BalancePipe} from '../../../pipes/balance.pipe';
import { balance_transform } from '../../calc/balance_calc';
import { getStablePrice } from 'src/app/libs/stable';

@Injectable()
export class AstroportBlunaLunaFarmInfoService implements FarmInfoService {
  farm = 'Astroport';
  autoCompound = true;
  autoStake = true;
  farmColor = '#463df6';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'LP';
  dex: DEX = 'Astroport';
  denomTokenContract = Denom.LUNA;
  highlight = false;
  mainnetOnly = true;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.bLunaToken;
  }

  constructor(
    private farmService: AstroportBlunalunaFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService,
    private balancePipe: BalancePipe
  ) {
  }

  get farmContract() {
    return this.terrajs.settings.astroportBlunaLunaFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.astroToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.astroportGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.farmService.query({ pools: {} });
    return pool.pools;
  }

  // Spectrum calculation
  // async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
  //   const key = `${this.dex}|${this.terrajs.settings.bLunaToken}|${Denom.LUNA}`;
  //   const depositAmountTask = this.wasm.query(this.terrajs.settings.astroportGenerator, { deposit: { lp_token: pairInfos[key].liquidity_token, user: this.farmContract }});
  //   const farmConfigTask = this.farmService.query({ config: {} });
  //
  //   // action
  //   const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
  //   const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
  //   const ulunaPrice = balance_transform('1', poolResponses[`${this.dex}|${Denom.LUNA}|${Denom.USD}`]);
  //   const astroPrice = balance_transform('1', poolResponses[`Astroport|${this.terrajs.settings.astroToken}|${Denom.USD}`]);
  //
  //   const lpStat = await this.getLPStat(poolResponses[key], astroPrice, ulunaPrice);
  //   const astroportGovStat = await this.getGovStat();
  //   const pairs: Record<string, PairStat> = {};
  //
  //   const depositAmount = +(await depositAmountTask);
  //   const farmConfig = await farmConfigTask;
  //   const communityFeeRate = +farmConfig.community_fee;
  //   const p = poolResponses[key];
  //   const ulunaAsset = p.assets.find(a => a.info.native_token?.['denom'] === Denom.LUNA);
  //   if (!ulunaAsset) {
  //     return;
  //   }
  //   const totalUlunaValueUST = times(ulunaPrice, ulunaAsset.amount);
  //
  //   const poolApr = +(lpStat.apr || 0);
  //   pairs[key] = createPairStat(poolApr, key);
  //   const pair = pairs[key];
  //   pair.tvl = new BigNumber(totalUlunaValueUST)
  //     .times(depositAmount)
  //     .times(2)
  //     .div(p.total_share)
  //     .toString();
  //   pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;
  //
  //   return pairs;
  //
  //   // tslint:disable-next-line:no-shadowed-variable
  //   function createPairStat(poolApr: number, key: string) {
  //     const poolInfo = poolInfos[key];
  //     const stat: PairStat = {
  //       poolApr,
  //       poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
  //       farmApr: +(astroportGovStat.apy || 0),
  //       tvl: '0',
  //       multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
  //       vaultFee: 0,
  //     };
  //     return stat;
  //   }
  // }

  // no LP APR calculation, return 0 to use Astroport API
  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const key = `${this.dex}|${this.terrajs.settings.bLunaToken}|${Denom.LUNA}`;
    const depositAmountTask = this.wasm.query(this.terrajs.settings.astroportGenerator, { deposit: { lp_token: pairInfos[key].liquidity_token, user: this.farmContract }});
    const farmConfigTask = this.farmService.query({ config: {} });

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
    const pairs: Record<string, PairStat> = {};

    const [depositAmount, farmConfig] = await Promise.all([depositAmountTask, farmConfigTask]);

    const communityFeeRate = +farmConfig.community_fee;
    const p = poolResponses[key];
    const ulunaPrice = balance_transform('1', poolResponses[`${this.dex}|${Denom.LUNA}|${Denom.USD}`]);

    const [ulunaAsset, blunaAsset] = p.assets[0].info.native_token?.['denom'] === Denom.LUNA
      ? [p.assets[0], p.assets[1]]
      : [p.assets[1], p.assets[0]];
    if (!ulunaAsset) {
      return;
    }
    const bLunaPrice = getStablePrice(+blunaAsset.amount, +ulunaAsset.amount);
    const bLunaSwap = new BigNumber(depositAmount)
      .times(blunaAsset.amount)
      .div(p.total_share)
      .times(bLunaPrice)
      .integerValue(BigNumber.ROUND_DOWN);

    const poolApr = 0;
    pairs[key] = createPairStat(poolApr, key);
    const pair = pairs[key];
    pair.tvl = new BigNumber(depositAmount)
      .times(ulunaAsset.amount)
      .div(p.total_share)
      .plus(bLunaSwap)
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
        farmApr:  0,
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
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.astroToken,
      {
        send: {
          contract: this.terrajs.settings.astroportGov,
          amount,
          msg: toBase64({ enter: {} })
        }
      }
    );
  }

  async getLPStat(poolResponse: PoolResponse, astroPrice: string, ulunaPrice: string) {
    const config = await this.wasm.query(this.terrajs.settings.astroportGenerator, {config: {}});
    const alloc_point = 250000;
    const astro_per_block = +config.tokens_per_block * (alloc_point / +config.total_alloc_point);
    const astro_total_emit_per_year = astro_per_block / 6.5 * 60 * 60 * 24 * 365;
    const blunaLunaTvl = +poolResponse.assets.find(asset => asset.info?.native_token?.['denom'] === Denom.LUNA).amount * +ulunaPrice * 2;
    const apr = astro_total_emit_per_year * +astroPrice / blunaLunaTvl;
    return {
      apr
    };
  }

  async getGovStat() {
    return {
      apy: 0
    };
  }

}
