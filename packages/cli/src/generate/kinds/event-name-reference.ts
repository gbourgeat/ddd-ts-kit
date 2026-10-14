import type { EventNames } from '../event-names.js';
import type { Scope } from '../scope.js';
import { declaresItsName } from './declares-its-name.js';

/**
 * How a reaction wired by a module file names the domain event it is attached to:
 * `InvoiceIssued.eventName`, the name the event class declares once, or the name written out for
 * an event class that does not declare it (one generated before 0.7), so that the reaction still
 * compiles.
 */
export function eventNameReference(scope: Scope, names: EventNames): string {
  return declaresItsName(scope, names) ? `${names.event.pascal}.eventName` : `'${names.eventName}'`;
}
