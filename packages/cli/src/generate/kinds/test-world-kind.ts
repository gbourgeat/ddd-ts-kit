import { CliError } from '../../cli-error.js';
import { toName } from '../../naming/index.js';
import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { openScope } from '../open-scope.js';
import { vars } from '../vars.js';
import { contextFakes } from './world/context-fakes.js';
import { worldVars } from './world/world-vars.js';

export const testWorldKind: Kind = {
  name: 'test-world',
  aliases: [],
  usage: 'test-world <context> [Name]',
  summary:
    'The arrangement several specs of a context share, in test/worlds/: the test application, or the buses, with every fake of test/fakes/.',
  positionals: ['context'],
  optionalPositionals: ['Name'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);
    const name = toName(request.args[1] ?? scope.context.kebab);

    if (!/^[a-z]/.test(name.kebab)) {
      throw new CliError(
        `"${request.args[1] ?? ''}" is not a name.`,
        'Name the world in words of the context, starting with a letter, or leave the name out: it is then the name of the context.',
      );
    }

    const { fakes, leftOut } = contextFakes(scope);
    const stack = scope.config.stack.di === 'tsyringe' ? 'tsyringe' : 'buses';

    emit(scope, vars(scope, { world: worldVars(scope, name, fakes) }), [
      [`test-world/world.${stack}.ts.tpl`, `test/worlds/${name.kebab}.world.ts`],
    ]);

    if (fakes.length === 0) {
      scope.ws.note(
        `${scope.dir}/test/fakes/ holds no fake the world can build: it gives the ${stack === 'tsyringe' ? 'test application' : 'buses'} alone. Generate a port or a repository (each comes with its fake), then run again with --force.`,
      );
    }

    leftOut.forEach((reason) => scope.ws.note(`Not in the world: ${reason}`));
  },
};
