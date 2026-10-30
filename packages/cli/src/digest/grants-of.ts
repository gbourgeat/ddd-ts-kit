import { isGranted } from '../check/authz/is-granted';
import { permissionSets } from '../check/authz/permission-sets';
import { type Scan, scan } from '../check/scan/scan';
import type { Config } from '../config';
import { contextFileAt, PERMISSIONS_FILE } from '../context-files';
import type { Workspace } from '../workspace';
import type { GrantSources, RoleList } from './grant-sources';

const SIGNED_IN = 'signed-in';

/** A tree whose config was read, with what grants its permissions. */
interface GrantedTree {
  readonly ws: Workspace;
  readonly config: Config;
  readonly grants: GrantSources;
}

/**
 * Who holds each permission of a context by name, in a project whose rights are roles: each role
 * whose list names it (by the entry of its set, its id or the wildcard of the context), and
 * `signed-in` when the grants of every signed-in person do. The set is read as the checker reads
 * it, under the name its permissions file exports. The wildcard `*` names no permission and is not
 * listed; a context without a permission set is granted nothing.
 */
export function grantsOf({ ws, config, grants: sources }: GrantedTree, context: string): (key: string) => string[] {
  const directory = `${config.contextsDir}/${context}`;
  const file = contextFileAt(PERMISSIONS_FILE, context, (relative) => ws.exists(`${directory}/${relative}`));

  const declared = permissionSets({ scan: scan(ws.read(`${directory}/${file}`) ?? '') }).find(
    (set) => set.context === context,
  );

  if (declared === undefined) {
    return () => [];
  }

  return (key) => [
    ...sources.lists.filter((list) => isGranted(within(sources.roles, list), declared, key)).map((list) => list.role),
    ...(isGranted(sources.signedIn, declared, key) ? [SIGNED_IN] : []),
  ];
}

/** The scan of one list alone, its strings at their offsets in it. */
function within(scanned: Scan, { from, to }: RoleList): Scan {
  return {
    ...scanned,
    code: scanned.code.slice(from, to + 1),
    strings: scanned.strings
      .filter((record) => record.start >= from && record.end <= to)
      .map((record) => ({ ...record, start: record.start - from, end: record.end - from })),
  };
}
