import { refreshContextDoc } from '../../docs/refresh-context-doc.js';
import { concept } from '../concept.js';
import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import { vars } from '../vars.js';
import { writeEventSourcedAggregate } from './write-event-sourced-aggregate.js';

export const aggregateKind: Kind = {
  name: 'aggregate',
  aliases: [],
  usage: 'aggregate <context> <Name> [--event-sourced] [--term "<Term>=<meaning>"]...',
  summary:
    'An aggregate root with create and rehydrate factories, its test data builder and its spec; with --event-sourced, its state is the replay of its events, with its birth event and the codec of its stored events.',
  positionals: ['context', 'Name'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'aggregate', strip: ['aggregate'] });

    if (scope.flags.eventSourced) {
      writeEventSourcedAggregate(scope, name);
      refreshContextDoc(scope.ws, scope.config, scope.context.kebab);

      return;
    }

    emit(scope, vars(scope, { name: named(name), aggregate: named(name) }), [
      ['aggregate/aggregate.ts.tpl', `domain/aggregates/${name.kebab}.aggregate.ts`],
      ['builder/builder.ts.tpl', `test/builders/${name.kebab}.builder.ts`],
      ['aggregate/aggregate.spec.ts.tpl', `test/unit/${name.kebab}.aggregate.spec.ts`],
    ]);

    refreshContextDoc(scope.ws, scope.config, scope.context.kebab);
  },
};
