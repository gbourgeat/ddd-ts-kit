import type { EventNames } from '../event-names.js';
import type { Scope } from '../scope.js';

const DECLARES_ITS_NAME = /\bstatic\s+readonly\s+eventName\s*=/;

/**
 * How a reaction names the domain event it is attached to: `InvoiceIssued.eventName`, the name the
 * event class declares once, or the name written out for an event class that does not declare it
 * (one generated before 0.6), so that the reaction still compiles.
 */
export function eventNameReference(scope: Scope, names: EventNames): string {
  const declared = scope.ws.read(`${scope.dir}/domain/events/${names.event.kebab}.event.ts`) ?? '';

  return DECLARES_ITS_NAME.test(declared) ? `${names.event.pascal}.eventName` : `'${names.eventName}'`;
}
