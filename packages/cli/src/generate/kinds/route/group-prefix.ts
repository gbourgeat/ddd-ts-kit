import type { CliError } from '../../../cli-error';
import { toName } from '../../../naming';
import { prerequisiteRefusal } from '../../prerequisite-refusal';
import type { Scope } from '../../scope';
import { groupFile } from './group-file';

const MAX_DEPTH = 8;

/** The prefix a group written on disk gives its controllers: its own after the ones of its parents, read from the sources. */
export function groupPrefix(scope: Scope, kebab: string, depth = 0): string {
  const file = `${scope.dir}/${groupFile(kebab)}.ts`;
  const read = scope.ws.read(file);
  const source = read ?? '';

  if (!/@RouteGroup\s*\(/.test(source) || depth > MAX_DEPTH) {
    throw noGroup(file, read === undefined);
  }

  scope.flags.builtOn?.(scope.ws.placed(file));

  const parent = /\bparent:\s*([A-Za-z_$][\w$]*)/.exec(source)?.[1];
  const own = /\bprefix:\s*['"]([^'"]*)['"]/.exec(source)?.[1] ?? '';
  const above = parent === undefined ? '' : groupPrefix(scope, toName(parent.replace(/Routes$/, '')).kebab, depth + 1);

  return `${above}${own}`;
}

/** A group not written yet is one an earlier command creates; a file that is no group is a mistake. */
function noGroup(file: string, missing: boolean): CliError {
  return prerequisiteRefusal(
    missing,
    `${file} declares no route group.`,
    'A route group is an empty class carrying @RouteGroup of @ddd-ts-kit/http: create one with `ddd-ts-kit generate route-group <context> <Name> --prefix <path>` and pass --group <Name>.',
  );
}
