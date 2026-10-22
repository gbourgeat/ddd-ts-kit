import { eventNames, type EventNames } from '../event-names';
import type { Scope } from '../scope';
import { writeDomainEvent } from './write-domain-event';

/** Kinds that react to a domain event create it when it is missing, so their output always compiles. */
export function ensureDomainEvent(scope: Scope, aggregateInput: string, factInput: string): EventNames {
  const names = eventNames(scope, aggregateInput, factInput);

  if (!scope.ws.exists(`${scope.dir}/domain/events/${names.event.kebab}.event.ts`)) {
    writeDomainEvent(scope, names);
  }

  return names;
}
