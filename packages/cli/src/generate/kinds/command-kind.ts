import { CliError } from '../../cli-error';
import type { Name } from '../../naming';
import { concept } from '../concept';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { refinedByPolicy } from '../refined-by-policy';
import { permissionWords } from '../permission-words';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { wire } from '../wire';
import { commandContext } from './command-context';
import type { UseCaseContext } from './use-case-context';
import { commandOutputs } from './command-outputs';
import { existingAggregate } from './existing-aggregate';
import { generateRepository } from './generate-repository';
import { repositoryLine } from './repository-line';
import { wireRepositoryOnFirstUse } from './wire-repository-on-first-use';

export const commandKind: Kind = {
  name: 'command',
  aliases: [],
  usage:
    'command <context> <UseCaseName> (--permission <aggregate>.<action> [--grant <role>] | --public) [--aggregate <Name> [--creates]] [--term "<Term>=<meaning>"]...',
  summary:
    'A command, its handler with injected ports, its spec and its registration on the command bus; with --aggregate the handler changes an existing aggregate and writes nothing until the domain is decided, with --creates it gives birth to one. With --aggregate, after `generate aggregate <context> <Name>`.',
  positionals: ['context', 'UseCaseName'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', {
      what: 'use case',
      strip: ['command', 'handler'],
      alongside: permissionWords(scope.flags.permission),
    });

    const aggregate =
      request.flags.aggregate === undefined ? undefined : existingAggregate(scope, request.flags.aggregate);

    if (scope.flags.creates && aggregate === undefined) {
      throw new CliError(
        '--creates names a command that gives birth to an aggregate, and no aggregate is named.',
        'Add --aggregate <Name>, or drop --creates: without an aggregate the handler has nothing to create.',
      );
    }

    const { permission } = scope.flags;

    const generated = commandContext(
      scope,
      { name, aggregate, creates: scope.flags.creates },
      permission !== undefined && refinedByPolicy(scope, permission),
    );

    writeCommand(scope, { name, aggregate }, generated);
  },
};

/** The files of the command, its repository when it is the first use of one, its wiring, and the note about the world. */
function writeCommand(
  scope: Scope,
  { name, aggregate }: { name: Name; aggregate: Name | undefined },
  { vars, worldHint }: UseCaseContext,
): void {
  if (
    aggregate !== undefined &&
    !scope.ws.exists(`${scope.dir}/domain/repositories/${aggregate.kebab}.repository.ts`)
  ) {
    generateRepository(scope, aggregate);
  }

  emit(scope, vars, commandOutputs(scope, name));

  if (worldHint !== undefined) {
    scope.ws.note(worldHint);
  }

  if (aggregate !== undefined) {
    wireRepositoryOnFirstUse(scope, aggregate);
  }

  wire(scope, aggregate === undefined ? 'command' : { kind: 'command', holding: repositoryLine(aggregate) }, vars);
}
