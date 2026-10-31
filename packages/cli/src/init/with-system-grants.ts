import { scan } from '../check/scan/scan';
import { closingBracket } from '../check/text/closing-bracket';
import { marker } from '../markers/marker';

const REGION = 'system-grants';
const SYSTEM = '[Role.System]';

/**
 * The object of the roles with the region `generate job` writes the grant of a system actor in: an
 * older template had the list and not the region, which joins the end of the list, what it holds
 * kept. Undefined when the object has no such list.
 */
export function withSystemGrants(object: string): string | undefined {
  if (object.split('\n').some((line) => marker(REGION, false).test(line))) {
    return object;
  }

  const { code } = scan(object);
  const key = code.indexOf(SYSTEM);
  const open = key === -1 ? -1 : code.indexOf('[', key + SYSTEM.length);
  const close = open === -1 ? undefined : closingBracket(code, open);

  if (close === undefined) {
    return undefined;
  }

  const held = object.slice(open + 1, close).trim();
  const items = held === '' ? '' : `    ${held.endsWith(',') ? held : `${held},`}\n`;

  return `${object.slice(0, open + 1)}\n${items}    // ddd-ts-kit:${REGION}\n    // /ddd-ts-kit:${REGION}\n  ${object.slice(close)}`;
}
