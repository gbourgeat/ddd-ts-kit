import type { Name } from '../../naming';
import { emit } from '../emit';
import { named } from '../named';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { assertEventStore } from './assert-event-store';
import { birthNames } from './birth-names';
import { instantOf } from './instant-of';
import { writeBirth } from './write-birth';

/** The fact an event-sourced aggregate is born with when `--birth` names none: its stream starts with it. */
const DEFAULT_BIRTH = 'Created';

/**
 * An event-sourced aggregate: the class with its birth event and the apply method of it, the codec
 * of its stored events, a builder that replays a history and a given-events spec. Refused while
 * the platform has no event store to save it through.
 */
export function writeEventSourcedAggregate(scope: Scope, name: Name): void {
  assertEventStore(scope);

  const names = birthNames(scope, name, scope.flags.birth ?? DEFAULT_BIRTH);

  const event = {
    ...named(names.event),
    name: names.eventName,
    fact: names.fact.pascal,
    instant: instantOf(names.fact),
  };

  const [aggregate] = emit(scope, vars(scope, { name: named(name), aggregate: named(name), event }), [
    ['aggregate/event-sourced.aggregate.ts.tpl', `domain/aggregates/${name.kebab}.aggregate.ts`],
    ['aggregate/event-sourced.events.mapper.ts.tpl', `infrastructure/persistence/${name.kebab}-events.mapper.ts`],
    ['builder/event-sourced.builder.ts.tpl', `test/builders/${name.kebab}.builder.ts`],
    ['aggregate/event-sourced.aggregate.spec.ts.tpl', `test/unit/${name.kebab}.aggregate.spec.ts`],
  ]);

  writeBirth(scope, name, names, aggregate === true);

  scope.ws.note(
    `${name.pascal} is event-sourced: \`ddd-ts-kit generate repository ${scope.context.kebab} ${name.pascal}\` writes its repository adapter, which delegates to EventSourcedRepository of @ddd-ts-kit/kernel over the EventStore the platform binds (persistence.eventSourcing, in the event_store schema; the SubjectKeyStore and the PersonalDataCipher of src/platform/event-sourcing/ seal its personal values), and its stored events are declared in infrastructure/persistence/${name.kebab}-events.mapper.ts. See docs/concepts/event-sourcing.md of ddd-ts-kit.`,
  );
}
