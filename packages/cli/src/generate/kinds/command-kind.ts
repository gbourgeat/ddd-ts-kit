import { concept } from '../concept.js';
import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { refinedByPolicy } from '../refined-by-policy.js';
import { openScope } from '../open-scope.js';
import { wire } from '../wire.js';
import { commandContext } from './command-context.js';
import { commandOutputs } from './command-outputs.js';
import { existingAggregate } from './existing-aggregate.js';
import { generateRepository } from './generate-repository.js';

export const commandKind: Kind = {
  name: 'command',
  aliases: [],
  usage:
    'command <context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] | --public) [--aggregate <Name>] [--term "<Term>=<meaning>"]...',
  summary: 'A command, its handler with injected ports, its spec and its registration on the command bus.',
  positionals: ['context', 'UseCaseName'],
  writesShared: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'use case', strip: ['command', 'handler'] });

    const aggregate =
      request.flags.aggregate === undefined ? undefined : existingAggregate(scope, request.flags.aggregate);

    const { permission } = scope.flags;

    const context = commandContext(
      scope,
      { name, aggregate },
      permission !== undefined && refinedByPolicy(scope, permission),
    );

    if (
      aggregate !== undefined &&
      !scope.ws.exists(`${scope.dir}/domain/repositories/${aggregate.kebab}.repository.ts`)
    ) {
      generateRepository(scope, aggregate);
    }

    emit(scope, context, commandOutputs(scope, name));
    wire(scope, 'command', context);
  },
};
