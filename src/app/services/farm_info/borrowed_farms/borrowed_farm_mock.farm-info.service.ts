import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { RewardInfoResponseItem } from '../../api/borrowed-farm/reward_info_response';
import { TerrajsService } from '../../terrajs.service';
import {
  DEX,
  FarmInfoService,
  FARM_TYPE_ENUM,
  PairStat,
  PoolInfo, PoolBorrowedFarmItem
} from './../farm-info.service';
import { MsgExecuteContract } from '@terra-money/terra.js';
import { toBase64 } from '../../../libs/base64';
import { PoolResponse } from '../../api/terraswap_pair/pool_response';
import { VaultsResponse } from '../../api/gov/vaults_response';
import { Denom } from '../../../consts/denom';
import { WasmService } from '../../api/wasm.service';
import { PairInfo } from '../../api/terraswap_factory/pair_info';
import { BalancePipe } from '../../../pipes/balance.pipe';
import { HttpClient } from '@angular/common/http';
import {BorrowedFarmService} from '../../api/borrowed-farm.service';
import {LeveragedFarmService} from '../../api/leveraged-farm.service';
import {AnchorFarmService} from '../../api/anchor-farm.service';

@Injectable()
export class BorrowedFarmMockFarmInfoService implements FarmInfoService { // TODO implements BorrowedFarmInfo

  get defaultBaseTokenContract() {
    return this.terrajs.settings.anchorToken;
  }

  constructor(
    private borrowedFarmService: BorrowedFarmService,
    private leverageFarmService: LeveragedFarmService,
    private farmService: AnchorFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService,
    private httpClient: HttpClient,
    private balancePipe: BalancePipe,
  ) {
  }

  get farmContract() {
    return this.terrajs.settings.astroportAncUstFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.anchorToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.anchorGov;
  }
  farm = 'Anchor';
  farmColor = '#3bac3b';
  auditWarning = false;
  farmType: FARM_TYPE_ENUM = 'BORROWED_FARM';
  dex: DEX = 'Astroport';
  denomTokenContract = Denom.USD;
  highlight = false;
  mainnetOnly = false;
  hasProxyReward = false;

  readonly autoCompound = true;
  readonly autoStake = false;


  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const key = `${this.dex}|${this.defaultBaseTokenContract}|${Denom.USD}`;
    const positionInfoTask = this.leverageFarmService.query(this.terrajs.settings.leveragedFarmA, { position: {
        user: this.farmContract
      } });
    const borrowedFarmConfigTask = this.borrowedFarmService.query(this.farmContract, { config: {} });

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
    const pairs: Record<string, PairStat> = {};

    const [positionInfo, farmConfig] = await Promise.all([positionInfoTask, borrowedFarmConfigTask]);
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
      .times(positionInfo.bond_amount)
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
    const rewardInfo = await this.borrowedFarmService.query(this.farmContract, {
      reward_info: {
        staker_addr: this.terrajs.address,
      }
    });
    return rewardInfo.reward_infos;
  }

  getStakeGovMsg(amount: string): MsgExecuteContract {
    return new MsgExecuteContract(
      this.terrajs.address,
      this.terrajs.settings.anchorToken,
      {
        send: {
          contract: this.terrajs.settings.anchorGov,
          amount,
          msg: toBase64({ stake_voting_tokens: {} })
        }
      }
    );
  }

  async getLPStat(poolResponse: PoolResponse, farmApr: number, astroPrice: number) {
    const config = await this.wasm.query(this.terrajs.settings.astroportGenerator, {config: {}});
    const alloc_point = 104444;
    const astro_per_block = +config.tokens_per_block * (alloc_point / +config.total_alloc_point);
    const astro_total_emit_per_year = astro_per_block / 6.5 * 60 * 60 * 24 * 365;
    const farmPoolUSTAmount = poolResponse.assets[1]?.info?.native_token?.['denom'] === Denom.USD ? poolResponse.assets[1].amount : poolResponse.assets[0].amount;
    const farmUSTTvl = +farmPoolUSTAmount * 2;
    const apr = (astro_total_emit_per_year * +astroPrice / farmUSTTvl) + farmApr;
    return {
      apr
    };
  }

  queryPoolItems(): Promise<PoolBorrowedFarmItem[]> {
    return Promise.resolve([]);
  }

}
