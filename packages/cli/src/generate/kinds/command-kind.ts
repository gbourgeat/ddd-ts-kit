import { concept } from '../concept';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { refinedByPolicy } from '../refined-by-policy';
import { openScope } from '../open-scope';
import { wire } from '../wire';
import { commandContext } from './command-context';
import { commandOutputs } from './command-outputs';
import { existingAggregate } from './existing-aggregate';
import { generateRepository } from './generate-repository';
import { wireRepositoryOnFirstUse } from './wire-repository-on-first-use';

export const commandKind: Kind = {
  name: 'command',
  aliases: [],
  usage:
    'command <context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] | --public) [--aggregate <Name>] [--term "<Term>=<meaning>"]...',
  summary: 'A command, its handler with injected ports, its spec and its registration on the command bus.',
  positionals: ['context', 'UseCaseName'],
  writesShared: true,
  writesInModules: true,
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

    if (aggregate !== undefined) {
      wireRepositoryOnFirstUse(scope, aggregate);
    }

    wire(scope, 'command', context);
  },
};
