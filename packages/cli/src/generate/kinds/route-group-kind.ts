import { specifierOf } from '../../alias';
import { CliError } from '../../cli-error';
import { toName } from '../../naming';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { label } from '../label';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { declareRole } from '../vocabulary/declare-role';
import { groupFile } from './route/group-file';
import { groupPrefix } from './route/group-prefix';
import { groupVars, type GroupDeclaration } from './route/group-vars';

const PREFIX = /^(\/(:[A-Za-z_][A-Za-z0-9_]*|[A-Za-z0-9._~-]+))*$/;

export const routeGroupKind: Kind = {
  name: 'route-group',
  aliases: ['group'],
  usage: 'route-group <context> <Name> [--prefix <path>] [--group <ParentName>] [--public | --role <role>]',
  summary:
    'A route group: an empty class carrying @RouteGroup with its path prefix, its tag and its guards (Authenticated unless --public or --role says otherwise); with --group, it refines that group and inherits from it.',
  positionals: ['context', 'Name'],
  writesShared: true,
  writesInModules: false,
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
