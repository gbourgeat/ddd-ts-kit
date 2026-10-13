import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import { vars } from '../vars.js';
import { existingAggregate } from './existing-aggregate.js';
import { parseTransitions } from './state-machine/parse-transitions.js';
import { stateMachineVars } from './state-machine/state-machine-vars.js';
import { statusVocabulary } from './state-machine/status-vocabulary.js';

export const stateMachineKind: Kind = {
  name: 'state-machine',
  aliases: [],
  usage:
    'state-machine <context> <Aggregate> [--value <state>]... [--transition "<intention>:<from>[,<from>]...[><to>]"]... [--term "<Term>=<meaning>"]...',
  summary:
    'The lifecycle of an aggregate: its status as the closed vocabulary <Aggregate>Status (created, or extended with the --value it misses, the first one initial), the machine of domain/state-machines/ with the transitions asked, and its spec. CONTEXT.md draws it.',
  positionals: ['context', 'Aggregate'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const aggregate = existingAggregate(scope, request.args[1] ?? '');
    const states = statusVocabulary(scope, aggregate);

    const transitions = parseTransitions(
      request.flags.transition,
      states.map(({ value }) => value),
    );

    const context = vars(scope, {
      aggregate: named(aggregate),
      machine: stateMachineVars({ aggregate, states, transitions }),
    });

    emit(scope, context, [
      ['state-machine/state-machine.ts.tpl', `domain/state-machines/${aggregate.kebab}.state-machine.ts`],
      ['state-machine/state-machine.spec.ts.tpl', `test/unit/${aggregate.kebab}.state-machine.spec.ts`],
    ]);
  },
};
