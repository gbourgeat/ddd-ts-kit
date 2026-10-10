import { emit } from '../emit.js';
import type { EventNames } from '../event-names.js';
import type { Scope } from '../scope.js';
import { eventVars } from './event-vars.js';

export function writeDomainEvent(scope: Scope, names: EventNames): void {
  emit(scope, eventVars(scope, names), [
    ['domain-event/domain-event.ts.tpl', `domain/events/${names.event.kebab}.event.ts`],
    ['domain-event/domain-event.spec.ts.tpl', `test/unit/${names.event.kebab}.event.spec.ts`],
  ]);
}
