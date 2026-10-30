import { isGranted } from '../check/authz/is-granted';
import { type Scan, scan } from '../check/scan/scan';
import { depthAt } from '../check/text/depth-at';
import { matchingBracket } from '../check/text/matching-bracket';
import type { Config } from '../config';
import { toName } from '../naming';
import { platformFileIn } from '../platform-layout';
import type { Workspace } from '../workspace';

const ROLES = /export\s+const\s+roles\b[^=]*=\s*\{/;
/** A key of the roles and the list it opens: `[Role.Accountant]: [`, `admin: [`. */
const ROLE_LIST = /(?:\[\s*([\w$.]+)\s*\]|([\w$]+))\s*:\s*\[/g;
const SIGNED_IN = 'signed-in';

/** A role of the platform and the part of the roles file its list of grants spans. */
interface RoleList {
  readonly role: string;
  readonly from: number;
  readonly to: number;
}

/**
 * Who holds each permission of a context by name, in a project whose rights are roles: each role
 * of `<platformDir>/auth/roles/roles.ts` whose list names it (by the entry of its set, its id or
 * the wildcard of the context), and `signed-in` when `auth/authorization/signed-in-grants.ts`
 * grants it to every signed-in person. The wildcard `*` names no permission and is not listed.
 */
export function grantsOf(ws: Workspace, config: Config, context: string): (key: string) => string[] {
  const permissionSet = { set: `${toName(context).camel}Permissions`, context };
  const exists = (file: string): boolean => ws.exists(file);
  const roles = scan(ws.read(platformFileIn(config, 'auth/roles/roles.ts', exists)) ?? '');
  const signedIn = scan(ws.read(platformFileIn(config, 'auth/authorization/signed-in-grants.ts', exists)) ?? '');
  const lists = roleLists(roles.code);

  return (key) => [
    ...lists.filter((list) => isGranted(within(roles, list), permissionSet, key)).map((list) => list.role),
    ...(isGranted(signedIn, permissionSet, key) ? [SIGNED_IN] : []),
  ];
}

/** The lists of the `roles` object, each under its key, at its first level. */
function roleLists(code: string): RoleList[] {
  const found = ROLES.exec(code);

  if (found === null) {
    return [];
  }

  const open = found.index + found[0].length - 1;
  const close = matchingBracket(code, open);

  return [...code.slice(open, close).matchAll(ROLE_LIST)]
    .filter((list) => depthAt(code, open, open + list.index) === 1)
    .map((list) => {
      const from = open + list.index + list[0].length - 1;

      return { role: list[1] ?? list[2] ?? '', from, to: matchingBracket(code, from) };
    });
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
