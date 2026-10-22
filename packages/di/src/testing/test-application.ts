import type { Actor, Session } from '@ddd-ts-kit/kernel';
import type { Application } from '../application/application';
import type { Resolve } from '../wiring/resolve';
import type { TestKernel } from './test-kernel';

export interface TestApplication extends Application, TestKernel {
  /** `resolve` under the name a test reads better with: `app.get(OrderRepository)`. */
  readonly get: Resolve;

  /**
   * Runs a block as someone else: infrastructure sees that actor (and that session, when one
   * is given) until the block is over, and the block receives the actor to put in its commands.
   * `await app.as(bob, (actor) => app.commandBus.execute(new VoidInvoice(actor, id)))`.
   */
  as<T>(who: Actor | Session, work: (actor: Actor) => T): T;
}
