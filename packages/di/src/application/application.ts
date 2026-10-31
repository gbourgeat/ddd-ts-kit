import type { WiringDescription } from '../description/wiring-description';
import type { Resolve } from '../wiring/resolve';

export interface Application<Native = unknown> {
  readonly resolve: Resolve;

  /** Calls `onStart` of every module, in declaration order, subscribes the consumers, then starts the job scheduler. */
  start(): Promise<void>;

  /**
   * Stops the job scheduler, unsubscribes the consumers, calls `onStop` of every started module, in
   * reverse order, gives the `ErrorReporter` two seconds to send what it still holds, then
   * flushes the `Logger`, last. Nothing may log through the application afterwards.
   */
  stop(): Promise<void>;

  /** The wiring as plain data, for diagnostics and generated documentation. */
  describe(): WiringDescription;

  /**
   * The underlying container, for interoperability: its type is the one of the entry point the
   * application was created from. A port is bound under `tokenIdentity(port)`, never under the
   * class, which some containers would build when asked for it.
   */
  readonly container: Native;
}
