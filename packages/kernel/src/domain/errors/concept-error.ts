import type { CodeOf } from './code-of.js';
import type { DomainErrorJson } from './domain-error-json.js';
import { DomainError } from './domain-error.js';
import type { RefusalFacts } from './refusal-facts.js';
import type { RefusalOf } from './refusal-of.js';
import type { Refusal } from './refusal.js';

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
export class ConceptError extends DomainError {
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

  /** Every fact of the refusal, for the code that catches it and for the tests. Private to the process. */
  readonly facts: RefusalFacts;

  private exposedNames: readonly string[] = [];

  protected constructor(code: string, message: string, facts: RefusalFacts) {
    super(message);
    this.code = code;
    this.facts = facts;
  }

  /** The facts a client may read: the ones the factory named, none by default. */
  get exposedFacts(): RefusalFacts {
    return Object.fromEntries(this.exposedNames.map((name) => [name, this.facts[name] ?? null]));
  }

  override toJSON(): DomainErrorJson {
    return { ...super.toJSON(), ...(this.exposedNames.length === 0 ? {} : { facts: this.exposedFacts }) };
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

  /** Called by a factory: these facts may leave the process, in a problem document for instance. */
  protected exposing(...names: readonly (keyof this['facts'] & string)[]): this {
    this.exposedNames = names;

    return this;
  }

  /** Called by a factory: the error this refusal translates. */
  protected causedBy(cause: unknown): this {
    Object.defineProperty(this, 'cause', { value: cause, writable: true, configurable: true, enumerable: false });

    return this;
  }
}
