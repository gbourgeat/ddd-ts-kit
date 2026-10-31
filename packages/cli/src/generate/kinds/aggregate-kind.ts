import { refreshContextDoc } from '../../docs/refresh-context-doc';
import { concept } from '../concept';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { named } from '../named';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { vars } from '../vars';
import type { Name } from '../../naming';
import { birthNames } from './birth-names';
import { birthVars } from './birth-vars';
import { writeBirth } from './write-birth';
import { writeEventSourcedAggregate } from './write-event-sourced-aggregate';

export const aggregateKind: Kind = {
  name: 'aggregate',
  aliases: [],
  usage: 'aggregate <context> <Name> [--birth "<Fact>"] [--event-sourced] [--term "<Term>=<meaning>"]...',
  summary:
    'An aggregate root with create and rehydrate factories, its test data builder and its spec; --birth names the fact it is born with, in business words ("Invoice Issued"), and writes that domain event, recorded by create at the instant it is given; with --event-sourced, its state is the replay of its events, born with that event (Created without --birth), and the codec of its stored events. Both --birth and --event-sourced apply when the aggregate is created: on one that exists, it is kept and a note says so.',
  positionals: ['context', 'Name'],
  writesShared: false,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'aggregate', strip: ['aggregate'] });

    if (scope.flags.eventSourced) {
      writeEventSourcedAggregate(scope, name);
    } else {
      writeAggregate(scope, name);
    }

    refreshContextDoc(scope.ws, scope.config, scope.context.kebab);
  },
};

/**
 * An aggregate that keeps its state in a table: the class, its builder and its spec; with `--birth`,
 * the domain event of its birth too, which `create` records, the builder and the spec named after it.
 */
function writeAggregate(scope: Scope, name: Name): void {
  const input = scope.flags.birth;
  const birth = input === undefined ? undefined : birthNames(scope, name, input);

  const [aggregate] = emit(scope, vars(scope, { name: named(name), aggregate: named(name), birth: birthVars(birth) }), [
    ['aggregate/aggregate.ts.tpl', `domain/aggregates/${name.kebab}.aggregate.ts`],
    ['builder/builder.ts.tpl', `test/builders/${name.kebab}.builder.ts`],
    ['aggregate/aggregate.spec.ts.tpl', `test/unit/${name.kebab}.aggregate.spec.ts`],
  ]);

  if (birth !== undefined) {
    writeBirth(scope, birth, aggregate === true);
  }
}
