export interface ReconnectOptions {
  /** Delay before a consumer that could not start, commit or dead-letter tries again. Default 200. */
  readonly initialMs?: number;
  /** Multiplier applied at each further attempt. Default 2. */
  readonly factor?: number;
  /** Upper bound of the delay. Default 30000. */
  readonly maxMs?: number;
}
