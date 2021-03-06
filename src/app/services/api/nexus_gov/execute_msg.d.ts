/* tslint:disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type ExecuteMsg =
  | {
      governance: {
        governance_msg: GovernanceMsg;
        [k: string]: unknown;
      };
    }
  | {
      anyone: {
        anyone_msg: AnyoneMsg;
        [k: string]: unknown;
      };
    }
  | {
      yourself: {
        yourself_msg: YourselfMsg;
        [k: string]: unknown;
      };
    }
  | {
      receive: Cw20ReceiveMsg;
    };
export type GovernanceMsg = {
  update_config: {
    owner?: string | null;
    proposal_deposit?: Uint128 | null;
    quorum?: Decimal | null;
    snapshot_period?: number | null;
    threshold?: Decimal | null;
    timelock_period?: number | null;
    voting_period?: number | null;
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
 * A fixed-point decimal value with 18 fractional digits, i.e. Decimal(1_000_000_000_000_000_000) == 1.0
 *
 * The greatest possible value that can be represented is 340282366920938463463.374607431768211455 (which is (2^128 - 1) / 10^18)
 */
export type Decimal = string;
export type AnyoneMsg =
  | {
      register_token: {
        psi_token: string;
        [k: string]: unknown;
      };
    }
  | {
      cast_vote: {
        amount: Uint128;
        poll_id: number;
        vote: VoteOption;
        [k: string]: unknown;
      };
    }
  | {
      withdraw_voting_tokens: {
        amount?: Uint128 | null;
        [k: string]: unknown;
      };
    }
  | {
      end_poll: {
        poll_id: number;
        [k: string]: unknown;
      };
    }
  | {
      execute_poll: {
        poll_id: number;
        [k: string]: unknown;
      };
    }
  | {
      snapshot_poll: {
        poll_id: number;
        [k: string]: unknown;
      };
    };
export type VoteOption = "yes" | "no";
export type YourselfMsg = {
  execute_poll_msgs: {
    poll_id: number;
    [k: string]: unknown;
  };
};
/**
 * Binary is a wrapper around Vec<u8> to add base64 de/serialization with serde. It also adds some helper methods to help encode inline.
 *
 * This is only needed as serde-json-{core,wasm} has a horrible encoding for Vec<u8>
 */
export type Binary = string;

/**
 * Cw20ReceiveMsg should be de/serialized under `Receive()` variant in a ExecuteMsg
 */
export interface Cw20ReceiveMsg {
  amount: Uint128;
  msg: Binary;
  sender: string;
  [k: string]: unknown;
}
