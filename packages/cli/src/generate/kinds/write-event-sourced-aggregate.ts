import type { Name } from '../../naming';
import { emit } from '../emit';
import { eventNames } from '../event-names';
import { named } from '../named';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { writeDomainEvent } from './write-domain-event';

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
    `${name.pascal} is event-sourced: its repository adapter delegates to EventSourcedRepository of @ddd-ts-kit/kernel over the EventStore the platform binds (persistence.eventSourcing, in the event_store schema; the SubjectKeyStore and the PersonalDataCipher of src/platform/privacy/ seal its personal values), and its stored events are declared in infrastructure/persistence/${name.kebab}-events.mapper.ts. See docs/concepts/event-sourcing.md of ddd-ts-kit.`,
  );
}
