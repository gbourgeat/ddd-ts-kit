import { type Scan, scan } from '../check/scan/scan';
import { depthAt } from '../check/text/depth-at';
import { matchingBracket } from '../check/text/matching-bracket';
import type { Config } from '../config';
import { platformFileIn } from '../platform-layout';
import type { Workspace } from '../workspace';

const ROLES = /export\s+const\s+roles\b[^=]*=\s*\{/;

/**
 * A key of the roles and the list it opens, read on the code whose literals are blanked, their
 * quotes kept: `[Role.Accountant]: [`, `admin: [`, `'accountant': [`, `['accountant']: [`.
 */
const ROLE_LIST = /(?:\[\s*(?:([\w$.]+)|(["'`])[^"'`]*\2)\s*\]|([\w$]+)|(["'`])[^"'`]*\4)\s*:\s*\[/g;

/** A role of the platform and the part of the roles file its list of grants spans. */
export interface RoleList {
  readonly role: string;
  readonly from: number;
  readonly to: number;
}

/** What grants a permission by name in a project: the lists of the roles, and what every signed-in person holds. */
export interface GrantSources {
  readonly roles: Scan;
  readonly lists: readonly RoleList[];
  readonly signedIn: Scan;
}

/**
 * The roles of `<platformDir>/auth/roles/roles.ts`, each with its list, and the grants of
 * `auth/authorization/signed-in-grants.ts`: read once for a tree, whatever the number of its
 * contexts. A file the project does not have grants nothing.
 */
export function grantSources(ws: Workspace, config: Config): GrantSources {
  const exists = (file: string): boolean => ws.exists(file);
  const roles = scan(ws.read(platformFileIn(config, 'auth/roles/roles.ts', exists)) ?? '');

  return {
    roles,
    lists: roleLists(roles),
    signedIn: scan(ws.read(platformFileIn(config, 'auth/authorization/signed-in-grants.ts', exists)) ?? ''),
  };
}

/** The lists of the `roles` object, each under its key as written (a string key by its value), at its first level. */
function roleLists(roles: Scan): RoleList[] {
  const { code } = roles;
  const found = ROLES.exec(code);

  if (found === null) {
    return [];
  }

  const open = found.index + found[0].length - 1;
  const close = matchingBracket(code, open);

  return [...code.slice(open, close).matchAll(ROLE_LIST)]
    .filter((list) => depthAt(code, open, open + list.index) === 1)
    .map((list) => {
      const at = open + list.index;
      const from = at + list[0].length - 1;

      return { role: list[1] ?? list[3] ?? keyText(roles, at), from, to: matchingBracket(code, from) };
    });
}

/** The value of the string literal a key opens with at `at`, or after its bracket. */
function keyText({ code, strings }: Scan, at: number): string {
  const quote = code.slice(at).search(/["'`]/);

  return strings.find((record) => record.start === at + quote)?.value ?? '';
}
