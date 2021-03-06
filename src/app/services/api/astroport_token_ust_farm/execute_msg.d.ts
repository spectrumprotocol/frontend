/* tslint:disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type ExecuteMsg =
  | {
      receive: Cw20ReceiveMsg;
    }
  | {
      update_config: {
        community_fee?: Decimal | null;
        controller?: string | null;
        controller_fee?: Decimal | null;
        deposit_fee?: Decimal | null;
        owner?: string | null;
        platform_fee?: Decimal | null;
        [k: string]: unknown;
      };
    }
  | {
      unbond: {
        amount: Uint128;
        asset_token: string;
        [k: string]: unknown;
      };
    }
  | {
      register_asset: {
        asset_token: string;
        staking_token: string;
        weight: number;
        [k: string]: unknown;
      };
    }
  | {
      withdraw: {
        asset_token?: string | null;
        farm2_amount?: Uint128 | null;
        farm_amount?: Uint128 | null;
        spec_amount?: Uint128 | null;
        [k: string]: unknown;
      };
    }
  | {
      stake: {
        asset_token: string;
        [k: string]: unknown;
      };
    }
  | {
      compound: {
        threshold_compound_astro: Uint128;
        [k: string]: unknown;
      };
    }
  | {
      update_bond: {
        amount_to_auto: Uint128;
        amount_to_stake: Uint128;
        asset_token: string;
        [k: string]: unknown;
      };
    }
  | {
      send_fee: {
        [k: string]: unknown;
      };
    };
/**
 * A thin wrapper around u128 that is using strings for JSON encoding/decoding, such that the full u128 range can be used for clients that convert JSON numbers to floats, like JavaScript and jq.
 *
 * # Examples
 *
 * Use `from` to create instances of this and `u128` to get the value out:
 *
 * ``` # use cosmwasm_std::Uint128; let a = Uint128::from(123u128); assert_eq!(a.u128(), 123);
 *
 * let b = Uint128::from(42u64); assert_eq!(b.u128(), 42);
 *
 * let c = Uint128::from(70u32); assert_eq!(c.u128(), 70); ```
 */
export type Uint128 = string;
/**
 * Binary is a wrapper around Vec<u8> to add base64 de/serialization with serde. It also adds some helper methods to help encode inline.
 *
 * This is only needed as serde-json-{core,wasm} has a horrible encoding for Vec<u8>
 */
export type Binary = string;
/**
 * A fixed-point decimal value with 18 fractional digits, i.e. Decimal(1_000_000_000_000_000_000) == 1.0
 *
 * The greatest possible value that can be represented is 340282366920938463463.374607431768211455 (which is (2^128 - 1) / 10^18)
 */
export type Decimal = string;

/**
 * Cw20ReceiveMsg should be de/serialized under `Receive()` variant in a ExecuteMsg
 */
export interface Cw20ReceiveMsg {
  amount: Uint128;
  msg: Binary;
  sender: string;
  [k: string]: unknown;
}
