import { CliError } from '../../cli-error';
import { refreshContextDoc } from '../../docs/refresh-context-doc';
import { concept } from '../concept';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { named } from '../named';
import { openScope } from '../open-scope';
import { vars } from '../vars';
import { writeEventSourcedAggregate } from './write-event-sourced-aggregate';

export const aggregateKind: Kind = {
  name: 'aggregate',
  aliases: [],
  usage: 'aggregate <context> <Name> [--event-sourced [--birth <Event>]] [--term "<Term>=<meaning>"]...',
  summary:
    'An aggregate root with create and rehydrate factories, its test data builder and its spec; with --event-sourced, its state is the replay of its events, with its birth event (Created, or the fact --birth names) and the codec of its stored events.',
  positionals: ['context', 'Name'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'aggregate', strip: ['aggregate'] });

    if (scope.flags.birth !== undefined && !scope.flags.eventSourced) {
      throw new CliError(
        '--birth names the birth event of an event-sourced aggregate.',
        'Add --event-sourced, or drop --birth: a plain aggregate has no birth event.',
      );
    }

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
