// import { Injectable } from '@angular/core';
// import { Apollo, gql } from 'apollo-angular';
// import BigNumber from 'bignumber.js';
// import { GovService } from '../api/gov.service';
// import { TerrajsService } from '../terrajs.service';
// import {
//   FarmInfoService,
//   PairStat,
//   PoolInfo,
//   PoolItem
// } from './farm-info.service';
// import { MsgExecuteContract } from '@terra-money/terra.js';
// import { toBase64 } from '../../libs/base64';
// import { PoolResponse } from '../api/terraswap_pair/pool_response';
// import { div } from '../../libs/math';
// import { Denom } from '../../consts/denom';
// import { KujiraFarmService } from '../api/kujira-farm.service';
// import { RewardInfoResponseItem } from '../api/kujira_farm/reward_info_response';
// import {WasmService} from '../api/wasm.service';
//
// @Injectable()
// export class KujiraFarmInfoService implements FarmInfoService {
//   farm = 'Kujira';
//   rewardSymbol = 'KUJI';
//   autoCompound = true;
//   autoStake = false;
//   farmColor = '#E53935';
//   denomSymbol = 'UST';
//   auditWarning = true;
//
//   constructor(
//     private gov: GovService,
//     private kujiraFarm: KujiraFarmService,
//     private terrajs: TerrajsService,
//     private wasm: WasmService
//   ) { }
//
//   get farmContract() {
//     return this.terrajs.settings.kujiraFarm;
//   }
//
//   get rewardTokenContract() {
//     return this.terrajs.settings.kujiraToken;
//   }
//
//   get farmGovContract() {
//     return null;
//   }
//
//   async queryPoolItems(): Promise<PoolItem[]> {
//     const pool = await this.kujiraFarm.query({ pools: {} });
//     return pool.pools;
//   }
//
//   async queryPairStats(poolInfos: Record<string, PoolInfo>, poolResponses: Record<string, PoolResponse>): Promise<Record<string, PairStat>> {
//     const unixTimeSecond = Math.floor(Date.now() / 1000);
//     const rewardInfoTask = this.wasm.query(this.terrajs.settings.kujiraStaking, { staker_info: { time_seconds: +unixTimeSecond, staker: this.terrajs.settings.kujiraFarm } });
//     const farmConfigTask = this.kujiraFarm.query({ config: {} });
//
//     // action
//     const totalWeight = Object.values(poolInfos).reduce((a, b) => a + b.weight, 0);
//     const govVaults = await this.gov.vaults();
//     const govWeight = govVaults.vaults.find(it => it.address === this.terrajs.settings.kujiraFarm)?.weight || 0;
//     const kujiraLPStat = await this.getKujiraLPStat(poolResponses[this.terrajs.settings.kujiraToken], unixTimeSecond);
//     const pairs: Record<string, PairStat> = {};
//
//     const rewardInfo = await rewardInfoTask;
//     const farmConfig = await farmConfigTask;
//     const govConfig = await this.gov.config();
//     const communityFeeRate = +farmConfig.community_fee * (1 - +govConfig.warchest_ratio);
//     const p = poolResponses[this.terrajs.settings.kujiraToken];
//     const uusd = p.assets.find(a => a.info.native_token?.['denom'] === 'uusd');
//     if (!uusd) {
//       return;
//     }
//     const specKUJITvl = new BigNumber(uusd.amount)
//       .times(rewardInfo.bond_amount)
//       .times(2)
//       .div(p.total_share)
//       .toString();
//
//     const poolApr = +(kujiraLPStat.apr || 0);
//     pairs[this.terrajs.settings.kujiraToken] = createPairStat(poolApr, this.terrajs.settings.kujiraToken);
//     const pair = pairs[this.terrajs.settings.kujiraToken];
//     pair.tvl = specKUJITvl;
//     pair.vaultFee = +pair.tvl * pair.poolApr * communityFeeRate;
//
//     return pairs;
//
//     // tslint:disable-next-line:no-shadowed-variable
//     function createPairStat(poolApr: number, token: string) {
//       const poolInfo = poolInfos[token];
//       const stat: PairStat = {
//         poolApr,
//         poolApy: (poolApr / 8760 + 1) ** 8760 - 1,
//         farmApr: 0,
//         tvl: '0',
//         multiplier: poolInfo ? govWeight * poolInfo.weight / totalWeight : 0,
//         vaultFee: 0,
//       };
//       return stat;
//     }
//   }
//
//   async queryRewards(): Promise<RewardInfoResponseItem[]> {
//     const rewardInfo = await this.kujiraFarm.query({
//       reward_info: {
//         staker_addr: this.terrajs.address,
//       }
//     });
//     return rewardInfo.reward_infos;
//   }
//
//   getStakeGovMsg(amount: string): MsgExecuteContract {
//     return null;
//   }
//
//   async getKujiraLPStat(kujiPoolResponse: PoolResponse, unixTimeSecond) {
//     const configTask = this.wasm.query(this.terrajs.settings.kujiraStaking, { config: {} });
//     const stateTask = this.wasm.query(this.terrajs.settings.kujiraStaking, { state: { time_seconds: +unixTimeSecond } });
//     const [config, state] = await Promise.all([configTask, stateTask]);
//     const distributionSchedule = config.distribution_schedule.find((e => e.start_time <= unixTimeSecond && unixTimeSecond <= e.end_time));
//     if (!distributionSchedule){
//           return {
//             apr: 0
//           };
//       }
//     const kujiAmount = kujiPoolResponse.assets.find(asset => asset.info.token['contract_addr'] === this.terrajs.settings.kujiraToken)?.amount ?? 0;
//     const i = +state.total_bond_amount / +kujiPoolResponse.total_share * +kujiAmount * 2;
//     const duration = distributionSchedule.end_time - distributionSchedule.start_time;
//     const apr = 31536e3 * (distributionSchedule.amount / duration) / (0 === i ? 1e6 : i);
//     return {
//       apr,
//     };
//   }
//
// }
