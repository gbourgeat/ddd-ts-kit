import { errorCodes } from '../../check/errors/error-codes.js';
import { scan } from '../../check/scan/scan.js';
import type { Scope } from '../scope.js';

/** Where each code of the error files of a context is set, as `file:line`. */
export function codesOfContext(scope: Scope): Map<string, string> {
  const directory = `${scope.dir}/domain/errors`;
  const taken = new Map<string, string>();

  for (const name of scope.ws.list(directory).filter((file) => file.endsWith('.error.ts'))) {
    const file = `${directory}/${name}`;

    for (const { code, line } of errorCodes(scan(scope.ws.read(file) ?? ''))) {
      if (!taken.has(code)) {
        taken.set(code, `${file}:${line}`);
      }
    }
  }

  return taken;
}
