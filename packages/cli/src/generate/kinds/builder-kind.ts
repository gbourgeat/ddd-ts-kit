import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import { vars } from '../vars.js';
import { existingAggregate } from './existing-aggregate.js';

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

    emit(scope, vars(scope, { aggregate: named(aggregate) }), [['builder/builder.ts.tpl', `test/builders/${aggregate.kebab}.builder.ts`]]);
  },
};
