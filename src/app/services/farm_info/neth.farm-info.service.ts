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
import { WasmService } from '../api/wasm.service';
import { VaultsResponse } from '../api/gov/vaults_response';
import {div, times} from '../../libs/math';
import { Apollo, gql } from 'apollo-angular';
import { Denom } from '../../consts/denom';
import {PairInfo} from '../api/terraswap_factory/pair_info';
import {NassetFarmService} from '../api/nasset-farm.service';
import {BalancePipe} from '../../pipes/balance.pipe';
import {TokenService} from '../api/token.service';

@Injectable()
export class NethFarmInfoService implements FarmInfoService {
  farm = 'Nexus';
  autoCompound = true;
  autoStake = true;
  farmColor = '#F4B6C7';
  farmType: FARM_TYPE_ENUM = 'NASSET';
  auditWarning = false;
  dex: DEX = 'Astroport';
  mainnetOnly = false;

  get defaultBaseTokenContract() {
    return this.terrajs.settings.nEthToken;
  }

  // not actually denom, but has trade pair
  get denomTokenContract() {
    return this.terrajs.settings.nexusToken;
  }

  constructor(
    private nassetFarmService: NassetFarmService,
    private terrajs: TerrajsService,
    private wasm: WasmService,
    private apollo: Apollo,
    private balancePipe: BalancePipe,
    private tokenService: TokenService
  ) { }

  get farmContract() {
    return this.terrajs.settings.nETHFarm;
  }

  get rewardTokenContract() {
    return this.terrajs.settings.nexusToken;
  }

  get farmGovContract() {
    return this.terrajs.settings.nexusGov;
  }

  async queryPoolItems(): Promise<PoolItem[]> {
    const pool = await this.nassetFarmService.query(this.farmContract, { pools: {} });
    return pool.pools;
  }

  async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>, govVaults: VaultsResponse, pairInfos: Record<string, PairInfo>): Promise<Record<string, PairStat>> {
    const farmConfigTask = this.nassetFarmService.query(this.farmContract, { config: {} });
    const nAssetBalanceTask = this.tokenService.balance(this.defaultBaseTokenContract, this.farmContract);
    const apollo = this.apollo.use(this.terrajs.settings.nexusGraph);
    const nexusGovStatTask = apollo.query<any>({
      query: gql`{
        getGovStakingAprRecords(limit: 1, offset: 0) {
          date
          govStakingApr
        }
      }`
    }).toPromise();
    // query: gql`{
    //     getBAssetVaultAprRecords(limit: 7, offset: 0) {
    //       date
    //       bEthVaultApr
    //       bEthVaultManualApr
    //       bLunaVaultApr
    //       bLunaVaultManualApr
    //      }`
    const nexusNAssetStatTask = apollo.query<any>({
      query: gql`{
        getBAssetVaultAprRecords(limit: 1, offset: 0) {
          bEthVaultApr
         }
        }`
    }).toPromise();

    // action
    const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
    const govWeight = govVaults.vaults.find(it => it.address === this.farmContract)?.weight || 0;
    const pairs: Record<string, PairStat> = {};

    const [farmConfig, nexusGovStat, nexusNAssetStat, nAssetBalance] = await Promise.all([farmConfigTask, nexusGovStatTask, nexusNAssetStatTask, nAssetBalanceTask]);
    const communityFeeRate = +farmConfig.community_fee;
    const psiPrice = this.balancePipe.transform('1', poolResponses[`Astroport|${this.terrajs.settings.nexusToken}|${Denom.USD}`]);
    const poolnAssetPsi = poolResponses[`Astroport|${this.defaultBaseTokenContract}|${this.terrajs.settings.nexusToken}`];
    const nAssetPricePerPsi = div(poolnAssetPsi.assets.find(asset => asset?.info?.token['contract_addr'] === this.terrajs.settings.nexusToken).amount,
                            poolnAssetPsi.assets.find(asset => asset?.info?.token['contract_addr'] === this.defaultBaseTokenContract).amount);
    const nAssetPricePerUST = times(nAssetPricePerPsi, psiPrice);

    const poolApr = +(nexusNAssetStat.data?.getBAssetVaultAprRecords[0]?.bEthVaultApr || 0) / 100;
    const key = `${this.defaultBaseTokenContract}`;
    pairs[key] = createPairStat(poolApr, key);
    const pair = pairs[key];
    pair.tvl = times(nAssetPricePerUST, nAssetBalance.balance);
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
        poolAstroApr: 0,
        specApr: 0
      };
      return stat;
    }
  }


  async queryRewards(): Promise<RewardInfoResponseItem[]> {
    const rewardInfo = await this.nassetFarmService.query(this.farmContract, {
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
