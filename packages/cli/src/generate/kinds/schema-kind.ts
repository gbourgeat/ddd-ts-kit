import { toName } from '../../naming/index.js';
import { emit } from '../emit.js';
import type { Kind, KindRequest } from '../kind.js';
import { label } from '../label.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { vars } from '../vars.js';

/** The first argument that writes in the shared kernel instead of a context. */
const SHARED_KERNEL = 'shared-kernel';

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
    const shared = request.args[0] === SHARED_KERNEL;
    const scope = shared ? sharedKernelScope(request) : openScope(request);
    const name = label(scope, request.args[1] ?? '', { what: 'schema', strip: ['schema', 'dto'] });
    const library = WRITTEN_WITH[scope.config.stack.validation] ?? 'custom';
    const directory = shared ? 'presentation' : 'presentation/http/shared';

    emit(scope, vars(scope, { name: named(name) }), [
      [`schema/schema.${library}.ts.tpl`, `${directory}/${name.kebab}.schema.ts`],
    ]);
  },
};

function sharedKernelScope({ ws, config, flags }: KindRequest): Scope {
  return { ws, config, flags, context: toName(SHARED_KERNEL), dir: config.sharedKernelDir };
}
