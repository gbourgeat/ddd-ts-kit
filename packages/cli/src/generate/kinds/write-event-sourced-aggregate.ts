import type { Name } from '../../naming/index.js';
import { emit } from '../emit.js';
import { eventNames } from '../event-names.js';
import { named } from '../named.js';
import type { Scope } from '../scope.js';
import { vars } from '../vars.js';
import { writeDomainEvent } from './write-domain-event.js';

/** The fact every event-sourced aggregate is born with: its stream starts with it. */
const BIRTH = 'Created';

/**
 * An event-sourced aggregate: the class with its birth event and the apply method of it, the codec
 * of its stored events, a builder that replays a history and a given-events spec.
 */
export function writeEventSourcedAggregate(scope: Scope, name: Name): void {
  const names = eventNames(scope, name.pascal, BIRTH);
  const event = { ...named(names.event), name: names.eventName, fact: names.fact.pascal };

  emit(scope, vars(scope, { name: named(name), aggregate: named(name), event }), [
    ['aggregate/event-sourced.aggregate.ts.tpl', `domain/aggregates/${name.kebab}.aggregate.ts`],
    ['aggregate/event-sourced.events.mapper.ts.tpl', `infrastructure/persistence/${name.kebab}-events.mapper.ts`],
    ['builder/event-sourced.builder.ts.tpl', `test/builders/${name.kebab}.builder.ts`],
    ['aggregate/event-sourced.aggregate.spec.ts.tpl', `test/unit/${name.kebab}.aggregate.spec.ts`],
  ]);

  writeDomainEvent(scope, names);

  scope.ws.note(
    `${name.pascal} is event-sourced: its repository adapter delegates to EventSourcedRepository of @ddd-ts-kit/kernel over the EventStore of the ORM adapter (createKnexEventSourcing, createDrizzleEventSourcing, createPrismaEventSourcing, createTypeOrmEventSourcing), and its stored events are declared in infrastructure/persistence/${name.kebab}-events.mapper.ts. See docs/concepts/event-sourcing.md of ddd-ts-kit.`,
  );
}
