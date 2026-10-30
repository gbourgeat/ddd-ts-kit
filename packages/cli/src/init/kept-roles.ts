import { matchingBracket } from '../check/text/matching-bracket';

const ROLES = /export\s+const\s+roles\b[^=]*=\s*\{/;

/** The file with the object of the roles of the file before, and that object. */
export interface KeptRoles {
  readonly text: string;
  readonly grants: string;
}

/**
 * The grants of the roles, written in the object of `roles.ts` and not in a region: it is the
 * object of the file before, in the place the template gives it. Undefined when that file holds
 * none the kit can read.
 */
export function keptRoles(written: string, existing: string): KeptRoles | undefined {
  const kept = rolesObject(existing);
  const place = rolesObject(written);

  return kept === undefined || place === undefined
    ? undefined
    : { text: `${written.slice(0, place.from)}${kept.text}${written.slice(place.to)}`, grants: kept.text };
}

interface Written {
  readonly from: number;
  readonly to: number;
  readonly text: string;
}

function rolesObject(source: string): Written | undefined {
  const found = ROLES.exec(source);

  if (found === null) {
    return undefined;
  }

  const from = found.index + found[0].length - 1;
  const to = matchingBracket(source, from) + 1;

  return { from, to, text: source.slice(from, to) };
}
