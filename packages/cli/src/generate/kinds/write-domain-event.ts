import { emit } from '../emit';
import type { EventNames } from '../event-names';
import type { Scope } from '../scope';
import { eventVars } from './event-vars';

export function writeDomainEvent(scope: Scope, names: EventNames): void {
  emit(scope, eventVars(scope, names), [
    ['domain-event/domain-event.ts.tpl', `domain/events/${names.event.kebab}.event.ts`],
    ['domain-event/domain-event.spec.ts.tpl', `test/unit/${names.event.kebab}.event.spec.ts`],
  ]);
}
