/* tslint:disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export type QueryMsg =
  | {
      config: {
        [k: string]: unknown;
      };
      [k: string]: unknown;
    }
  | {
      state: {
        block_height?: number | null;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    }
  | {
      staker_info: {
        block_height?: number | null;
        staker: HumanAddr;
        [k: string]: unknown;
      };
      [k: string]: unknown;
    };
export type HumanAddr = string;
