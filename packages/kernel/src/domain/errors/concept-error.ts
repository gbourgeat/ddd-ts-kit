import type { CodeOf } from './code-of';
import { FactualRefusal } from './factual-refusal';
import type { RefusalFacts } from './refusal-facts';
import type { RefusalOf } from './refusal-of';
import type { Refusal } from './refusal';

/**
 * The errors of one concept of the model, each built by a static factory named in the words of
 * the business:
 *
 *     export class AppointmentError extends ConceptError {
 *       static slotTaken(calendarId: string, startsAt: Date) {
 *         return AppointmentError.refusal('SLOT_TAKEN', `The slot ... is already held.`, { calendarId, startsAt });
 *       }
 *     }
 *
 * The constructor is protected and a subclass declares none: outside its class a refusal exists
 * only through a factory, with the code and the message that factory wrote. The facts are
 * private until the factory exposes some by name (`.exposing('startsAt')`).
 */
export class ConceptError extends FactualRefusal {
  /** Narrows what was caught to a refusal of this class, of this code when one is given. */
  static is<C extends { readonly prototype: object }, const Code extends CodeOf<C> = CodeOf<C>>(
    this: C,
    error: unknown,
    code?: Code,
  ): error is RefusalOf<C, Code> {
    const expected: string | undefined = code;

    return (
      error instanceof ConceptError &&
      Object.prototype.isPrototypeOf.call(this.prototype, error) &&
      (expected === undefined || error.code === expected)
    );
  }

  readonly code: string;

  protected constructor(code: string, message: string, facts: RefusalFacts) {
    super(message, facts);
    this.code = code;
  }

  /** Builds the refusal of a factory: its code, the message it wrote and the facts it was given. */
  protected static refusal<E, const Code extends string, const Facts extends RefusalFacts = RefusalFacts>(
    this: { readonly prototype: E },
    code: Code,
    message: string,
    facts?: Facts,
  ): Refusal<E, Code, Facts>;

  protected static refusal(code: string, message: string, facts: RefusalFacts = {}): ConceptError {
    return new this(code, message, facts);
  }
}
