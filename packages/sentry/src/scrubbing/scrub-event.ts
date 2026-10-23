import { DomainError, SCRUBBED_MESSAGE } from '@ddd-ts-kit/kernel';
import type { ErrorEvent, EventHint } from '@sentry/node';
import { scrubRequest } from './scrub-request';

export interface ScrubOptions {
  /** Replaces the message of every error that is not a `DomainError`. */
  readonly scrubMessages: boolean;
}

const DEEPEST_CAUSE = 8;

/**
 * What leaves the process, whatever an integration or the project put on the event: of the
 * request, its method and its URL without query string; of the user, the id alone. With
 * `scrubMessages`, an exception keeps its message only when a `DomainError` of that class is
 * in the chain of the reported error: those messages are written by the project, the others
 * come from drivers and libraries and quote the data they choked on.
 */
export function scrubEvent(event: ErrorEvent, hint: EventHint, options: ScrubOptions): ErrorEvent {
  if (event.request !== undefined) {
    event.request = scrubRequest(event.request);
  }

  if (event.user !== undefined) {
    event.user = event.user.id === undefined ? {} : { id: event.user.id };
  }

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
