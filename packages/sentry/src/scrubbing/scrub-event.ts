import { DomainError, REDACTED, SCRUBBED_MESSAGE } from '@ddd-ts-kit/kernel';
import type { ErrorEvent, EventHint } from '@sentry/node';
import { scrubRequest } from './scrub-request';
import { withoutQuotedValues } from './without-quoted-values';

export interface ScrubOptions {
  /** Replaces the message of every error that is not a `DomainError`. */
  readonly scrubMessages: boolean;
}

const DEEPEST_CAUSE = 8;
const DEEPEST_FIELD = 8;

/* Where a driver keeps the values of a statement on its error: TypeORM, Knex, Drizzle. */
const PARAMETER_KEYS: ReadonlySet<string> = new Set(['parameters', 'params', 'bindings']);

/**
 * What leaves the process, whatever an integration or the project put on the event: of the
 * request, its method and its URL without query string; of the user, the id alone; of a failed
 * statement, the statement without the values a driver quotes, in the messages and in what an
 * integration copied of the error (`extra`, contexts). With `scrubMessages`, an exception keeps its
 * message only when a `DomainError` of that class is in the chain of the reported error: those
 * messages are written by the project, the others come from drivers and libraries and quote the
 * data they choked on.
 */
export function scrubEvent(event: ErrorEvent, hint: EventHint, options: ScrubOptions): ErrorEvent {
  if (event.request !== undefined) {
    event.request = scrubRequest(event.request);
  }

  if (event.user !== undefined) {
    event.user = event.user.id === undefined ? {} : { id: event.user.id };
  }

  dropQuotedValues(event);

  if (options.scrubMessages) {
    scrubMessages(event, domainErrorNames(hint.originalException, DEEPEST_CAUSE));
  }

  return event;
}

function domainErrorNames(error: unknown, depth: number): string[] {
  if (typeof error !== 'object' || error === null || depth === 0) {
    return [];
  }

  return [
    ...(error instanceof DomainError ? [error.name, error.constructor.name] : []),
    ...innerErrors(error).flatMap((one) => domainErrorNames(one, depth - 1)),
  ];
}

function innerErrors(error: object): unknown[] {
  const aggregated: unknown[] = error instanceof AggregateError ? error.errors : [];

  return 'cause' in error ? [error.cause, ...aggregated] : aggregated;
}

function dropQuotedValues(event: ErrorEvent): void {
  for (const exception of event.exception?.values ?? []) {
    if (exception.value !== undefined) {
      exception.value = withoutQuotedValues(exception.value);
    }
  }

  if (event.message !== undefined) {
    event.message = withoutQuotedValues(event.message);
  }

  if (event.extra !== undefined) {
    event.extra = withoutValuesIn(event.extra, DEEPEST_FIELD);
  }

  if (event.contexts !== undefined) {
    event.contexts = withoutValuesIn(event.contexts, DEEPEST_FIELD);
  }
}

/** What an integration copied of an error (`detail`, `parameters` of TypeORM), its values redacted. */
function withoutValuesIn<Fields extends Record<string, unknown>>(fields: Fields, depth: number): Fields {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    redacted[key] = PARAMETER_KEYS.has(key) ? REDACTED : withoutValuesOf(value, depth - 1);
  }

  return Object.assign(fields, redacted);
}

function withoutValuesOf(value: unknown, depth: number): unknown {
  if (typeof value === 'string') {
    return withoutQuotedValues(value);
  }

  if (depth === 0 || typeof value !== 'object' || value === null) {
    return value;
  }

  return Array.isArray(value)
    ? value.map((one: unknown) => withoutValuesOf(one, depth - 1))
    : withoutValuesIn({ ...value }, depth);
}

function scrubMessages(event: ErrorEvent, kept: readonly string[]): void {
  for (const exception of event.exception?.values ?? []) {
    if (exception.type === undefined || !kept.includes(exception.type)) {
      exception.value = SCRUBBED_MESSAGE;
    }
  }

  if (event.message !== undefined) {
    event.message = SCRUBBED_MESSAGE;
  }
}
