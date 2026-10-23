import type { DomainErrorJson } from './domain-error-json';

/**
 * A violated business rule. The `code` is the stable, machine-readable contract
 * (HTTP mapping, i18n, API docs); the message is for humans and may change.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }

  /** What `JSON.stringify` writes of a refusal: never its stack, its cause or a fact it did not expose. */
  toJSON(): DomainErrorJson {
    return { name: this.name, code: this.code, message: this.message };
  }
}
