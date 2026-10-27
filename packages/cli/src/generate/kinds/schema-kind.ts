import { emit } from '../emit';
import type { Kind } from '../kind';
import { label } from '../label';
import { named } from '../named';
import { openScope } from '../open-scope';
import { isSharedKernel } from '../is-shared-kernel';
import { vars } from '../vars';

/** The schema libraries that have a template of their own; any other writes a schema wrapped by the kit. */
const WRITTEN_WITH: Readonly<Record<string, string>> = {
  zod: 'zod',
  'class-validator': 'class-validator',
  typebox: 'typebox',
};

export const schemaKind: Kind = {
  name: 'schema',
  aliases: [],
  usage: 'schema <context|shared-kernel> <Name>',
  summary:
    'One shape of the HTTP contract, declared once and shared: presentation/http/shared/<name>.schema.ts of a context, or presentation/<name>.schema.ts of the shared kernel when several contexts answer with it. Routes use it whole, nested or in part; the contract documents it once and refers to it.',
  positionals: ['context', 'Name'],
  writesShared: true,
  run: (request) => {
    const scope = openScope(request, { sharedKernel: true });
    const name = label(scope, request.args[1] ?? '', { what: 'schema', strip: ['schema', 'dto'] });
    const library = WRITTEN_WITH[scope.config.stack.validation] ?? 'custom';
    const directory = isSharedKernel(scope) ? 'presentation' : 'presentation/http/shared';

    emit(scope, vars(scope, { name: named(name) }), [
      [`schema/schema.${library}.ts.tpl`, `${directory}/${name.kebab}.schema.ts`],
    ]);
  },
};
