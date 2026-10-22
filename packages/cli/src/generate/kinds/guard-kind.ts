import { CONFIG_FILE } from '../../config';
import { CliError } from '../../cli-error';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { label } from '../label';
import { named } from '../named';
import { openScope } from '../open-scope';
import { vars } from '../vars';

export const guardKind: Kind = {
  name: 'guard',
  aliases: [],
  usage: 'guard <context> <Name>',
  summary:
    'A guard of the project: a declared class in presentation/http/guards/ that a route group or a controller names in `guards`, and its spec. It controls the caller at the edge; permissions stay on the use cases.',
  positionals: ['context', 'Name'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);

    if (scope.config.stack.http === 'none') {
      throw new CliError(
        'This project has no HTTP stack (stack.http is "none").',
        `Set stack.http to express, fastify or nest in ${CONFIG_FILE}: a guard stands before the controllers of a route group.`,
      );
    }

    const name = label(scope, request.args[1] ?? '', { what: 'guard', strip: ['guard'] });

    emit(scope, vars(scope, { name: named(name) }), [
      ['controller/guard.ts.tpl', `presentation/http/guards/${name.kebab}.guard.ts`],
      ['controller/guard.spec.ts.tpl', `test/unit/${name.kebab}.guard.spec.ts`],
    ]);
  },
};
