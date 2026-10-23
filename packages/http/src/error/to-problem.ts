import { DomainError, FactualRefusal, type RefusalFacts } from '@ddd-ts-kit/kernel';
import { ValidationError } from '@ddd-ts-kit/validation';
import type { ErrorMapper } from './error-mapper';
import { INTERNAL_ERROR_CODE } from './internal-error-code';
import type { Problem } from './problem';
import { statusTitle } from './status-title';

export function toProblem(error: unknown, mapper: ErrorMapper, requestId: string): Problem {
  if (!(error instanceof DomainError)) {
    return internalProblem(requestId);
  }

  const status = mapper.statusOf(error.code);

  if (status >= 500) {
    // A domain error mapped to a server fault is no longer the client's business.
    return { ...internalProblem(requestId), status, title: statusTitle(status), code: error.code };
  }

  return {
    type: mapper.typeOf(error.code),
    title: statusTitle(status),
    status,
    code: error.code,
    detail: publicDetail(error),
    ...(error instanceof ValidationError ? { issues: error.issues } : {}),
    ...exposedFacts(error),
    requestId,
  };
}

/**
 * The sentence a client reads. The message of a refusal built by a factory may quote the facts
 * it was given (an address, an identifier): it is answered unless it quotes one that the
 * factory did not expose. Then the client reads a sentence made from the code alone, and the
 * message stays where the error is logged and reported.
 */
function publicDetail(error: DomainError): string {
  if (!(error instanceof FactualRefusal)) {
    return error.message;
  }

  const exposed = error.exposedFacts;
  const hidden = Object.entries(error.facts).filter(([name]) => !(name in exposed));

  return hidden.some(([, value]) => quotes(error.message, value)) ? sentenceOf(error.code) : error.message;
}

/** Whether the text holds the value as a factory would write it: a text, a number, an instant, or one of what a list or a record holds. */
function quotes(text: string, value: unknown): boolean {
  if (typeof value === 'string') {
    return value !== '' && text.includes(value);
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return text.includes(String(value));
  }

  if (value instanceof Date) {
    return text.includes(value.toISOString()) || text.includes(String(value));
  }

  return typeof value === 'object' && value !== null && Object.values(value).some((part) => quotes(text, part));
}

/** `INVALID_EMAIL` read as `Invalid email.` */
function sentenceOf(code: string): string {
  const words = code.toLowerCase().replaceAll('_', ' ');

  return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}

/** Only what the factory of the refusal exposed by name: a fact never leaves the process by default. */
function exposedFacts(error: DomainError): { facts?: RefusalFacts } {
  if (!(error instanceof FactualRefusal)) {
    return {};
  }

  const facts = error.exposedFacts;

  return Object.keys(facts).length === 0 ? {} : { facts };
}

// The message of an unexpected error quotes data and internals: it never leaves the process.
function internalProblem(requestId: string): Problem {
  return {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    code: INTERNAL_ERROR_CODE,
    requestId,
  };
}
