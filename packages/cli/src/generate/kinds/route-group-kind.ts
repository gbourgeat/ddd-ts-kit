import { specifierOf } from '../../alias/index.js';
import { CliError } from '../../cli-error.js';
import { toName } from '../../naming/index.js';
import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { label } from '../label.js';
import { openScope } from '../open-scope.js';
import type { Scope } from '../scope.js';
import { vars } from '../vars.js';
import { declareRole } from '../vocabulary/declare-role.js';
import { groupFile } from './route/group-file.js';
import { groupPrefix } from './route/group-prefix.js';
import { groupVars, type GroupDeclaration } from './route/group-vars.js';

const PREFIX = /^(\/(:[A-Za-z_][A-Za-z0-9_]*|[A-Za-z0-9._~-]+))*$/;

export const routeGroupKind: Kind = {
  name: 'route-group',
  aliases: ['group'],
  usage: 'route-group <context> <Name> [--prefix <path>] [--group <ParentName>] [--public | --role <role>]',
  summary:
    'A route group: an empty class carrying @RouteGroup with its path prefix, its tag and its guards (Authenticated unless --public or --role says otherwise); with --group, it refines that group and inherits from it.',
  positionals: ['context', 'Name'],
  writesShared: true,
  run: (request) => {
    const scope = openScope(request);
    const name = label(scope, (request.args[1] ?? '').replace(/Routes$/, ''), { what: 'route group' });
    const { prefix = '', role } = scope.flags;

    if (!PREFIX.test(prefix)) {
      throw new CliError(
        `"${prefix}" is not a valid prefix.`,
        'Pass --prefix made of literal segments and ":name" parameters, with no trailing slash, for example /practices/:practiceId.',
      );
    }

    if (scope.flags.public && role !== undefined) {
      throw new CliError('--public and --role exclude each other.', 'A group is open, or it requires a role.');
    }

    const group = {
      name,
      prefix,
      tag: scope.context.kebab,
      ...accessOf(scope),
      ...(role === undefined ? {} : { role: declareRole(scope, role) }),
    };

    emit(scope, vars(scope, { group: groupVars(group) }), [['controller/group.ts.tpl', `${groupFile(name.kebab)}.ts`]]);
  },
};

function accessOf(scope: Scope): Pick<GroupDeclaration, 'access' | 'parent'> {
  const asked = scope.flags.group;

  if (asked === undefined) {
    return { access: scope.flags.public ? 'public' : 'authenticated' };
  }

  const parent = toName(asked.replace(/Routes$/, ''));

  // Reading its prefix refuses a parent that is no route group.
  groupPrefix(scope, parent.kebab);

  return {
    access: scope.flags.public ? 'public' : 'inherited',
    parent: {
      className: `${parent.pascal}Routes`,
      specifier: specifierOf(scope.config, `${scope.dir}/${groupFile(parent.kebab)}.ts`),
    },
  };
}
