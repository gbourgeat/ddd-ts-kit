import type { BindingAspect } from '../model/binding-aspect.js';

export interface PortOptions {
  /** A new instance on every resolution, instead of one per application. */
  readonly transient?: boolean;
  /**
   * The class takes the place of a binding made by a module listed earlier, typically a default
   * of the kernel module: a database unit of work, an outbox publisher.
   */
  readonly replaces?: boolean;
  /** Wraps every instance, the first aspect outermost: `aspects: [retry(...), timeout(2000)]`. */
  readonly aspects?: readonly BindingAspect[];
}
