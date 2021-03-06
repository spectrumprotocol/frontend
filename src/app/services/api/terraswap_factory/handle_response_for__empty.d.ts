/* tslint:disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * Binary is a wrapper around Vec<u8> to add base64 de/serialization with serde. It also adds some helper methods to help encode inline.
 *
 * This is only needed as serde-json-{core,wasm} has a horrible encoding for Vec<u8>
 */
export type Binary = string;
export type CosmosMsgFor_Empty =
  | {
      bank: BankMsg;
      [k: string]: unknown;
    }
  | {
      custom: Empty;
      [k: string]: unknown;
    }
  | {
      staking: StakingMsg;
      [k: string]: unknown;
    }
  | {
      wasm: WasmMsg;
      [k: string]: unknown;
    };
export type BankMsg = {
  send: {
    amount: Coin[];
    from_address: HumanAddr;
    to_address: HumanAddr;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};
export type Uint128 = string;
export type HumanAddr = string;
export type StakingMsg =
  | {
      delegate: {
        amount: Coin;
        validator: HumanAddr;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    }
  | {
      undelegate: {
        amount: Coin;
        validator: HumanAddr;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    }
  | {
      withdraw: {
        /**
         * this is the "withdraw address", the one that should receive the rewards if None, then use delegator address
         */
        recipient?: HumanAddr | null;
        validator: HumanAddr;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    }
  | {
      redelegate: {
        amount: Coin;
        dst_validator: HumanAddr;
        src_validator: HumanAddr;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
export type WasmMsg =
  | {
      execute: {
        contract_addr: HumanAddr;
        /**
         * msg is the json-encoded HandleMsg struct (as raw Binary)
         */
        msg: Binary;
        send: Coin[];
        [k: string]: unknown;
      };
      [k: string]: unknown;
    }
  | {
      instantiate: {
        code_id: number;
        /**
         * optional human-readbale label for the contract
         */
        label?: string | null;
        /**
         * msg is the json-encoded InitMsg struct (as raw Binary)
         */
        msg: Binary;
        send: Coin[];
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };

export interface HandleResponseFor_Empty {
  data?: Binary | null;
  log: LogAttribute[];
  messages: CosmosMsgFor_Empty[];
  [k: string]: unknown;
}
export interface LogAttribute {
  key: string;
  value: string;
  [k: string]: unknown;
}
export interface Coin {
  amount: Uint128;
  denom: string;
  [k: string]: unknown;
}
/**
 * An empty struct that serves as a placeholder in different places, such as contracts that don't set a custom message.
 *
 * It is designed to be expressable in correct JSON and JSON Schema but contains no meaningful data. Previously we used enums without cases, but those cannot represented as valid JSON Schema (https://github.com/CosmWasm/cosmwasm/issues/451)
 */
export interface Empty {
  [k: string]: unknown;
}
