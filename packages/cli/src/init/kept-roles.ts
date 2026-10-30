import { scan } from '../check/scan/scan';
import { closingBracket } from '../check/text/closing-bracket';

const ROLES = /export\s+const\s+roles\b[^=]*=\s*\{/;
/** What may follow the object of the roles in a statement that the kit can trust it read to its end. */
const ENDS_THE_STATEMENT = /^\s*(?:;|as\b|satisfies\b)/;

/** The file with the object of the roles of the file before, and that object. */
export interface KeptRoles {
  readonly text: string;
  readonly grants: string;
}

/**
 * The grants of the roles, written in the object of `roles.ts` and not in a region: it is the
 * object of the file before, in the place the template gives it. Undefined when that file holds
 * none the kit reads to its end: half an object is never written.
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

/** Read on the code alone: a bracket in a comment or a string closes nothing. */
function rolesObject(source: string): Written | undefined {
  const { code } = scan(source);
  const found = ROLES.exec(code);
  const from = found === null ? undefined : found.index + found[0].length - 1;
  const close = from === undefined ? undefined : closingBracket(code, from);

  if (from === undefined || close === undefined || !ENDS_THE_STATEMENT.test(code.slice(close + 1))) {
    return undefined;
  }

  return { from, to: close + 1, text: source.slice(from, close + 1) };
}
