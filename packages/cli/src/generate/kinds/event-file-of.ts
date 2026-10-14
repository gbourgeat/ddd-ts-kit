import type { EventNames } from '../event-names.js';
import type { Scope } from '../scope.js';

/** The file of the event class, under domain/events/ of its context. */
export function eventFileOf(scope: Scope, names: EventNames): string {
  return `${scope.dir}/domain/events/${names.event.kebab}.event.ts`;
}
