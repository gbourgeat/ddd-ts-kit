import { KIT_CODE_KEYS } from '../check/errors/kit-code-keys';
import { KIT_CODES_LIST } from '../check/errors/kit-codes-list';

/** The code an entry of the `errors` of a function route names: a string, or a member of the code list of the kit (`KitCodes.Forbidden`); anything else is itself. */
export function declaredCode(entry: string): string {
  const [list, key = ''] = entry.split('.');

  return (list === KIT_CODES_LIST ? KIT_CODE_KEYS.get(key) : undefined) ?? entry.replace(/^['"]|['"]$/g, '');
}
