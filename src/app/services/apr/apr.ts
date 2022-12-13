import BigNumber from "bignumber.js"
import { Denom } from "../../consts/denom";
import { div } from "../../libs/math";
import { PoolResponse } from "../../services/api/terraswap_pair/pool_response";
import { TerrajsService } from "../../services/terrajs.service";
import { listed} from "./data";
import { PairPool, StakingPool } from "./type";

const num = (number: BigNumber.Value) => new BigNumber(number)

export const parsePairPool = (pool?: PairPool) => {
  if (!pool) return { uusd: "0", asset: "0", total: "0" }

  const { assets, total_share } = pool
  return {
    uusd: assets.find(({ info }) => "native_token" in info)?.amount ?? "0",
    asset: assets.find(({ info }) => "token" in info)?.amount ?? "0",
    total: total_share ?? "0",
  }
}

const getAssetPrice = (pool: PoolResponse, terrajs: TerrajsService) => {
  const [asset, ust] = pool.assets[0].info.token?.['contract_addr'] === terrajs.settings.mirrorToken
  ? [pool.assets[0].amount, pool.assets[1].amount]
  : [pool.assets[1].amount, pool.assets[0].amount];
  return div(ust, asset);
}

export const assetsAPRQuery = ( terrajs: TerrajsService, poolResponses: Record<string, PoolResponse>, annualRewards, stakingPoolInfoAssets: Record<string, StakingPool>) => {

    const mirPool = poolResponses[`Astroport|${terrajs.settings.mirrorToken}|${Denom.USD}`];
    const mirPrice = getAssetPrice(mirPool, terrajs);
    const pairPoolAssets = listed.reduce(
      (acc, { token }) => ({ ...acc, [token]: poolResponses[`Terraswap|${token}|${Denom.USD}`] }),
      {}
    );
    const pairPrices = listed.reduce(
      (acc, { token }) => ({ ...acc, [token]: `${getAssetPrice(poolResponses[`Terraswap|${token}|${Denom.USD}`], terrajs)}` }),
      {}
    );

    const getAPR = (token: string) => {
      const annualReward = annualRewards[token]
      const stakingPoolInfo = stakingPoolInfoAssets![token]
      const pairPool = parsePairPool(pairPoolAssets![token])
      const price = pairPrices[token]

      if (annualReward === "0") {
        return { long: "0", short: "0" }
      }

      const { short_reward_weight, total_bond_amount, total_short_amount } =
        stakingPoolInfo
      const { asset: pool, uusd: uusdPool, total: lpShares } = pairPool

      const stakedLiquidityValue = num(uusdPool)
        .dividedBy(pool)
        .multipliedBy(pool)
        .plus(uusdPool)
        .multipliedBy(num(total_bond_amount).dividedBy(lpShares))

      const longReward = num(annualReward).multipliedBy(
        num(1).minus(short_reward_weight || 0)
      )

      const shortValue = num(
        [total_short_amount, price].every((n) => num(n).isGreaterThan(0))
          ? num(total_short_amount).multipliedBy(price).toFixed(0)
          : "0"
      )

      const shortReward = num(annualReward).multipliedBy(short_reward_weight)

      return {
        long: stakedLiquidityValue.isGreaterThan(0)
          ? longReward
              .multipliedBy(mirPrice)
              .dividedBy(stakedLiquidityValue)
              .toFixed(4)
          : "0",
        short: shortValue.isGreaterThan(0)
          ? shortReward.multipliedBy(mirPrice).dividedBy(shortValue).toFixed(4)
          : "0",
      }
    }

    return listed.reduce(
      (acc, { token }) => ({ ...acc, [token]: getAPR(token) }),
      {}
    )
  }