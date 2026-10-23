import { emit } from '../emit';
import type { Kind } from '../kind';
import { named } from '../named';
import { openScope } from '../open-scope';
import { vars } from '../vars';
import { existingAggregate } from './existing-aggregate';

export const builderKind: Kind = {
  name: 'builder',
  aliases: [],
  usage: 'builder <context> <Aggregate>',
  summary: 'The test data builder of an existing aggregate, in test/builders/.',
  positionals: ['context', 'Aggregate'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);
    const aggregate = existingAggregate(scope, request.args[1] ?? '');

    emit(scope, vars(scope, { aggregate: named(aggregate) }), [
      ['builder/builder.ts.tpl', `test/builders/${aggregate.kebab}.builder.ts`],
    ]);
  },
};
