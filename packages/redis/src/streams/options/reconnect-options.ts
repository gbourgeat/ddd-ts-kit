export interface ReconnectOptions {
  /** Delay before the first reconnection attempt. Default 200. */
  readonly initialMs?: number;

  /** Multiplier applied at each further attempt. Default 2. */
  readonly factor?: number;

  /** Upper bound of the delay. Default 30000. */
  readonly maxMs?: number;
}
