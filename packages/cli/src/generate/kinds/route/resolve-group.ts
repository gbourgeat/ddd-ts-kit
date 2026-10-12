import { CliError } from '../../../cli-error.js';
import { toName } from '../../../naming/index.js';
import type { Scope } from '../../scope.js';
import type { Endpoint } from './endpoint.js';
import { groupFile } from './group-file.js';
import { groupPrefix } from './group-prefix.js';
import { resourceOf } from './resource-of.js';
import type { RouteGroup } from './route-group.js';
import type { UseCase } from './use-case.js';

/**
 * The group of a new controller: the one `--group` names, which must exist; otherwise the group
 * of the resource its path starts with, created with the controller behind `Authenticated`. A
 * public use case stands in none: its controller says `guards: [Public]` itself.
 */
export function resolveGroup(scope: Scope, endpoint: Endpoint, useCase: UseCase): RouteGroup | undefined {
  const asked = scope.flags.group;

  if (asked === undefined && !useCase.isProtected) {
    return undefined;
  }

  const name = toName((asked ?? resourceOf(scope, endpoint)).replace(/Routes$/, ''));
  const file = groupFile(name.kebab);
  const exists = scope.ws.exists(`${scope.dir}/${file}.ts`);

  if (asked !== undefined && !exists) {
    throw new CliError(
      `The route group ${name.pascal}Routes does not exist in "${scope.context.kebab}" (${scope.dir}/${file}.ts).`,
      `Create it first with \`ddd-ts-kit generate route-group ${scope.context.kebab} ${name.pascal} --prefix <path>\`.`,
    );
  }

  const prefix = exists ? groupPrefix(scope, name.kebab) : defaultPrefix(scope, name.kebab);

  if (prefix !== '' && endpoint.path !== prefix && !endpoint.path.startsWith(`${prefix}/`)) {
    throw new CliError(
      `The path ${endpoint.path} is not under the prefix ${prefix} of the route group ${name.pascal}Routes.`,
      'Pass the whole path of the route, prefix included, or name another group with --group <Name>.',
    );
  }

  return { name, file, prefix, exists };
}

function defaultPrefix(scope: Scope, kebab: string): string {
  return kebab === scope.context.kebab ? '' : `/${kebab}`;
}
