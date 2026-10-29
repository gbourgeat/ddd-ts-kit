import { CliError } from '../../cli-error';
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
import { repositoryLine } from './repository-line';
import { wireRepositoryOnFirstUse } from './wire-repository-on-first-use';
import { noteWorldArrangement } from './world/note-world-arrangement';

export const commandKind: Kind = {
  name: 'command',
  aliases: [],
  usage:
    'command <context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] | --public) [--aggregate <Name> [--creates]] [--term "<Term>=<meaning>"]...',
  summary:
    'A command, its handler with injected ports, its spec and its registration on the command bus; with --aggregate the handler changes an existing aggregate and writes nothing until the domain is decided, with --creates it gives birth to one.',
  positionals: ['context', 'UseCaseName'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'use case', strip: ['command', 'handler'] });

    const aggregate =
      request.flags.aggregate === undefined ? undefined : existingAggregate(scope, request.flags.aggregate);

    if (scope.flags.creates && aggregate === undefined) {
      throw new CliError(
        '--creates names a command that gives birth to an aggregate, and no aggregate is named.',
        'Add --aggregate <Name>, or drop --creates: without an aggregate the handler has nothing to create.',
      );
    }

    const { permission } = scope.flags;

    const context = commandContext(
      scope,
      { name, aggregate, creates: scope.flags.creates },
      permission !== undefined && refinedByPolicy(scope, permission),
    );

    if (
      aggregate !== undefined &&
      !scope.ws.exists(`${scope.dir}/domain/repositories/${aggregate.kebab}.repository.ts`)
    ) {
      generateRepository(scope, aggregate);
    }

    emit(scope, context, commandOutputs(scope, name));
    noteWorldArrangement(scope, context);

    if (aggregate !== undefined) {
      wireRepositoryOnFirstUse(scope, aggregate);
    }

    wire(scope, aggregate === undefined ? 'command' : { kind: 'command', holding: repositoryLine(aggregate) }, context);
  },
};
