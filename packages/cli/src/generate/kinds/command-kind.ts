import type { Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import { accessVars } from '../access-vars.js';
import { concept } from '../concept.js';
import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { learnTerms } from '../learn-terms.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { specVars } from '../spec-vars.js';
import { vars } from '../vars.js';
import { wire } from '../wire.js';
import { existingAggregate } from './existing-aggregate.js';
import { generateRepository } from './generate-repository.js';

export const commandKind: Kind = {
  name: 'command',
  aliases: [],
  usage:
    'command <context> <UseCaseName> (--permission <aggregate>.<action> | --public) [--aggregate <Name>] [--term "<Term>=<meaning>"]...',
  summary: 'A command, its handler with injected ports, its spec and its registration on the command bus.',
  positionals: ['context', 'UseCaseName'],
  writesShared: true,
  run: (request) => {
    const scope = openScope(request);

    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', { what: 'use case', strip: ['command', 'handler'] });

    const aggregate =
      request.flags.aggregate === undefined ? undefined : existingAggregate(scope, request.flags.aggregate);

    const access = accessVars(scope, { name, kind: 'Command' });

    if (
      aggregate !== undefined &&
      !scope.ws.exists(`${scope.dir}/domain/repositories/${aggregate.kebab}.repository.ts`)
    ) {
      generateRepository(scope, aggregate);
    }

    writeCommand(
      scope,
      name,
      vars(scope, { name: named(name), access, spec: specVars(scope, access), ...commandVars(aggregate) }),
    );
  },
};

function commandVars(aggregate: Name | undefined): RenderContext {
  return {
    command: { hasAggregate: aggregate !== undefined, result: aggregate === undefined ? 'void' : 'string' },
    ...(aggregate === undefined ? {} : { aggregate: named(aggregate) }),
  };
}

function writeCommand(scope: Scope, name: Name, context: RenderContext): void {
  const folder = `application/commands/${name.kebab}`;

  emit(scope, context, [
    ['command/command.ts.tpl', `${folder}/${name.kebab}.command.ts`],
    ['command/handler.ts.tpl', `${folder}/${name.kebab}.handler.ts`],
    [
      `command/handler.spec.${scope.config.stack.di === 'tsyringe' ? 'tsyringe' : 'buses'}.ts.tpl`,
      `test/unit/${name.kebab}.handler.spec.ts`,
    ],
  ]);

  wire(scope, 'command', context);
}
