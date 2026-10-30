import type { Name } from '../../naming';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { named } from '../named';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { vars } from '../vars';
import type { Birth } from './birth';
import { birthOf } from './birth-of';
import { birthVars } from './birth-vars';
import { existingAggregate } from './existing-aggregate';
import { factoryOf } from './factory-of';
import { instantOf } from './instant-of';
import { isEventSourced } from './is-event-sourced';
import { parameterCount } from './parameter-count';

/** What `create` of a generated aggregate takes: its identifier and the instant it is born at. */
const GENERATED_PARAMETERS = 2;

export const builderKind: Kind = {
  name: 'builder',
  aliases: [],
  usage: 'builder <context> <Aggregate>',
  summary:
    'The test data builder of an existing aggregate, in test/builders/; the instant of its birth is an ingredient named after the fact its create records (issuedAt), and the builder of an event-sourced aggregate replays its birth event. After `generate aggregate <context> <Aggregate>`.',
  positionals: ['context', 'Aggregate'],
  writesShared: false,
  writesInModules: false,
  run: (request) => {
    const scope = openScope(request);
    const aggregate = existingAggregate(scope, request.args[1] ?? '');
    const read = birthOf(scope, aggregate);

    if ('unreadable' in read) {
      refrain(scope, aggregate, read.unreadable);

      return;
    }

    writeBuilder(scope, aggregate, read.birth);
    noteFactsAtBirth(scope, aggregate);
  },
};

/** No builder is better than one whose `construct` calls `create` in a way it does not take. */
function refrain(scope: Scope, aggregate: Name, why: string): void {
  scope.ws.note(
    `${why}: no builder written. Write test/builders/${aggregate.kebab}.builder.ts by hand, a \`construct\` that calls \`${aggregate.pascal}.create\` as it is declared.`,
  );
}

function writeBuilder(scope: Scope, aggregate: Name, birth: Birth | undefined): void {
  const target = `test/builders/${aggregate.kebab}.builder.ts`;

  if (!isEventSourced(scope, aggregate)) {
    emit(scope, vars(scope, { aggregate: named(aggregate), birth: birthVars(birth) }), [
      ['builder/builder.ts.tpl', target],
    ]);

    return;
  }

  if (birth === undefined) {
    refrain(scope, aggregate, `\`create\` of the event-sourced ${aggregate.pascal} records no birth event`);

    return;
  }

  const event = { ...named(birth.event), instant: instantOf(birth.fact) };

  emit(scope, vars(scope, { aggregate: named(aggregate), event }), [['builder/event-sourced.builder.ts.tpl', target]]);
}

/** A `create` that takes more than its identifier and its instant needs ingredients the builder cannot guess. */
function noteFactsAtBirth(scope: Scope, aggregate: Name): void {
  const factory = factoryOf(scope.ws.read(`${scope.dir}/domain/aggregates/${aggregate.kebab}.aggregate.ts`) ?? '');
  const count = factory === undefined ? GENERATED_PARAMETERS : parameterCount(factory);

  if (count > GENERATED_PARAMETERS) {
    scope.ws.note(
      `\`create\` of ${aggregate.pascal} takes ${String(count)} parameters: give the builder an ingredient for each one beyond its identifier and its instant, with a valid default, and pass it in \`construct\`.`,
    );
  }
}
