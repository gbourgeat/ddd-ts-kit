import { FactualRefusal } from './factual-refusal.js';
import type { RefusalFacts } from './refusal-facts.js';
import type { RefusalOf } from './refusal-of.js';
import type { Refusal } from './refusal.js';

/**
 * One refusal of the model, named after what is refused, with its code, and built by static
 * factories named after what the refusal is about:
 *
 *     export class InsufficientFunds extends DomainRefusal {
 *       readonly code = 'INSUFFICIENT_FUNDS';
 *
 *       static forAccountId(accountId: string, missing: number) {
 *         return InsufficientFunds.refusal(`Account ${accountId} lacks ${missing}.`, { accountId, missing });
 *       }
 *     }
 *
 *     throw InsufficientFunds.forAccountId(account.id, missing);
 *
 * The constructor is protected and a subclass declares none: outside its class a refusal exists
 * only through a factory, with the message that factory wrote. The facts are private until the
 * factory exposes some by name (`.exposing('missing')`).
 */
export abstract class DomainRefusal extends FactualRefusal {
  /** Narrows what was caught to this refusal, with the facts of its factories. */
  static is<C extends { readonly prototype: object }>(this: C, error: unknown): error is RefusalOf<C> {
    return error instanceof DomainRefusal && Object.prototype.isPrototypeOf.call(this.prototype, error);
  }

  // A factory calls `refusal`; the facts a subclass is built with are the ones `refusal` was given.
  protected constructor(message: string, facts: RefusalFacts = {}) {
    super(message, facts);
  }

  /** Builds the refusal of a factory: the message it wrote and the facts it was given. */
  protected static refusal<E extends { readonly code: string }, const Facts extends RefusalFacts = RefusalFacts>(
    this: { readonly prototype: E },
    message: string,
    facts?: Facts,
  ): Refusal<E, E['code'], Facts>;

  protected static refusal(
    this: new (
      message: string,
      facts?: RefusalFacts,
    ) => DomainRefusal,
    message: string,
    facts?: RefusalFacts,
  ): DomainRefusal {
    return new this(message, facts);
  }
}
