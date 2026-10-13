import type { ExecuteOptions } from '../pipeline/execute-options.js';

export interface HonoMountOptions extends ExecuteOptions {
  /**
   * The largest JSON body read, in bytes: a larger one is answered 413 as a problem
   * (`BODY_TOO_LARGE`) before the pipeline runs, without being held in memory. 1 MiB by default,
   * the limit of Fastify; Express answers beyond 100 kB. An upload has the limit its route declares.
   */
  readonly bodyLimit?: number;
}
