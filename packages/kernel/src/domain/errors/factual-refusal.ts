import type { DomainErrorJson } from './domain-error-json.js';
import { DomainError } from './domain-error.js';
import type { RefusalFacts } from './refusal-facts.js';

/**
 * A refusal built by a static factory, whichever form the project writes (`DomainRefusal`, one
 * class per refusal, or `ConceptError`, one class per concept): it carries the facts the factory
 * was given, keeps them private until the factory exposes some by name (`.exposing('startsAt')`),
 * and may keep the error it translates (`.causedBy(cause)`).
 */
export abstract class FactualRefusal extends DomainError {
  /** Every fact of the refusal, for the code that catches it and for the tests. Private to the process. */
  readonly facts: RefusalFacts;

  private exposedNames: readonly string[] = [];

  protected constructor(message: string, facts: RefusalFacts) {
    super(message);
    this.facts = facts;
  }

  /** The facts a client may read: the ones the factory named, none by default. */
  get exposedFacts(): RefusalFacts {
    return Object.fromEntries(this.exposedNames.map((name) => [name, this.facts[name] ?? null]));
  }

  override toJSON(): DomainErrorJson {
    return { ...super.toJSON(), ...(this.exposedNames.length === 0 ? {} : { facts: this.exposedFacts }) };
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
