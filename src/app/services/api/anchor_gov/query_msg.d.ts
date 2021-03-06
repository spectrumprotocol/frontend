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
    }
  | {
      state: {
        [k: string]: unknown;
      };
    }
  | {
      staker: {
        address: string;
        [k: string]: unknown;
      };
    }
  | {
      poll: {
        poll_id: number;
        [k: string]: unknown;
      };
    }
  | {
      polls: {
        filter?: PollStatus | null;
        limit?: number | null;
        order_by?: OrderBy | null;
        start_after?: number | null;
        [k: string]: unknown;
      };
    }
  | {
      voters: {
        limit?: number | null;
        order_by?: OrderBy | null;
        poll_id: number;
        start_after?: string | null;
        [k: string]: unknown;
      };
    };
export type PollStatus = "in_progress" | "passed" | "rejected" | "executed" | "expired" | "failed";
export type OrderBy = "asc" | "desc";
