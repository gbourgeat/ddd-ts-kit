import type { DependencyContainer } from 'tsyringe';
import type { WiringDescription } from '../description/wiring-description.js';
import type { Resolve } from '../wiring/resolve.js';

export interface Application {
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
   * The underlying tsyringe child container, for interoperability. A port is registered under
   * `tokenIdentity(port)`, never under the class: tsyringe would build a class it is asked for.
   */
  readonly container: DependencyContainer;
}
