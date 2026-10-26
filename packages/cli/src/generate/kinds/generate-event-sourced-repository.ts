import { CliError } from '../../cli-error';
import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import { emit } from '../emit';
import { named } from '../named';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { wire } from '../wire';
import { assertEventStore } from './assert-event-store';

/**
 * The repository of an event-sourced aggregate: the port, an adapter that delegates to
 * `EventSourcedRepository` of the kernel over the `EventStore` and the cipher the platform binds
 * with the codec of the stored events, the fake that is that adapter over the in-memory stores,
 * and the contract suite run on both. No table and no row mapper: the events are the storage.
 */
export function generateEventSourcedRepository(scope: Scope, aggregate: Name): RenderContext {
  assertEventStore(scope);
  assertCodec(scope, aggregate);
  assertNoColumns(scope);

  const context = vars(scope, { aggregate: named(aggregate) });

  emit(scope, context, [
    ['repository/repository.ts.tpl', `domain/repositories/${aggregate.kebab}.repository.ts`],
    [
      'repository/event-sourced/repository.ts.tpl',
      `infrastructure/persistence/event-store-${aggregate.kebab}.repository.ts`,
    ],
    ['repository/event-sourced/fake.ts.tpl', `test/fakes/${aggregate.kebab}.repository.fake.ts`],
    [
      'repository/event-sourced/contract.spec.ts.tpl',
      `test/integration/${aggregate.kebab}.repository.contract.spec.ts`,
    ],
  ]);

  wire(scope, 'repository/event-sourced', context);

  scope.ws.note(
    `${aggregate.pascal} is event-sourced: EventStore${aggregate.pascal}Repository delegates to EventSourcedRepository over the EventStore the platform binds, with the codec of infrastructure/persistence/${aggregate.kebab}-events.mapper.ts; there is no table. Fake${aggregate.pascal}Repository is that adapter over the in-memory event store, and the repository contract (test/integration) runs on both once its \`mutate\` records an event. The event store keeps no tenant: a stream is \`${scope.context.kebab}.${aggregate.kebab}-<id>\`, so decide who may load an id in the application layer.`,
  );

  return context;
}

function assertCodec(scope: Scope, aggregate: Name): void {
  const codec = `${scope.dir}/infrastructure/persistence/${aggregate.kebab}-events.mapper.ts`;

  if (scope.ws.exists(codec)) {
    return;
  }

  throw new CliError(
    `${aggregate.pascal} is event-sourced but the codec of its stored events is missing (${codec}).`,
    `Write it (it exports \`${aggregate.camel}Events\`, a StoredEventTypes with one defineStoredEvent per event, as \`ddd-ts-kit generate aggregate ${scope.context.kebab} ${aggregate.pascal} --event-sourced\` writes it), then generate the repository again.`,
  );
}

/** The columns of a table are rows: an event-sourced aggregate has none, its personal values are sealed in its events. */
function assertNoColumns(scope: Scope): void {
  if (scope.flags.personal === undefined) {
    return;
  }

  throw new CliError(
    '--personal declares columns of a table, and an event-sourced aggregate has none.',
    'Write the personal values of its events with `personalData(subjectId, value)` in the codec of its stored events (docs/concepts/event-sourcing.md of ddd-ts-kit, "Personal data").',
  );
}
