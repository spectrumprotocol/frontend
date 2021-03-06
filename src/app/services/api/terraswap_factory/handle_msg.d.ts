/* tslint:disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type HandleMsg =
  | {
      update_config: {
        owner?: HumanAddr | null;
        pair_code_id?: number | null;
        token_code_id?: number | null;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    }
  | {
      create_pair: {
        /**
         * Asset infos
         */
        asset_infos: [AssetInfo, AssetInfo];
        /**
         * Init hook for after works
         */
        init_hook?: InitHook | null;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    }
  | {
      register: {
        asset_infos: [AssetInfo, AssetInfo];
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
export type HumanAddr = string;
export type AssetInfo =
  | {
      token: {
        contract_addr: HumanAddr;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    }
  | {
      native_token: {
        denom: string;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
/**
 * Binary is a wrapper around Vec<u8> to add base64 de/serialization with serde. It also adds some helper methods to help encode inline.
 *
 * This is only needed as serde-json-{core,wasm} has a horrible encoding for Vec<u8>
 */
export type Binary = string;

export interface InitHook {
  contract_addr: HumanAddr;
  msg: Binary;
  [k: string]: unknown;
}
