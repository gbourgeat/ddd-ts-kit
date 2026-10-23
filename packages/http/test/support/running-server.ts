import type { ExecuteOptions, Route } from '../../src';

export interface RunningServer {
  readonly url: string;
  close(): Promise<void>;
}

export type StartServer = (routes: readonly Route[], options: ExecuteOptions) => Promise<RunningServer>;

/** How each adapter reads the test credential out of its own request object. */
export type ReadAuthorization = (raw: unknown) => string | undefined;
