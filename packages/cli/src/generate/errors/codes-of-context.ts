import { errorCodes } from '../../check/errors/error-codes';
import { scan } from '../../check/scan/scan';
import type { Scope } from '../scope';
import { roleFilesOf, treeOf } from '../../model-modules';

/** Where each code of the error files of a context is set, as `file:line`. */
export function codesOfContext(scope: Scope): Map<string, string> {
  const taken = new Map<string, string>();

  const files = roleFilesOf(scope.ws, treeOf(scope.config, scope.context.kebab), 'domain/errors').filter(({ name }) =>
    name.endsWith('.error.ts'),
  );

  for (const { path: file } of files) {
    for (const { code, line } of errorCodes(scan(scope.ws.read(file) ?? ''))) {
      if (!taken.has(code)) {
        taken.set(code, `${file}:${line}`);
      }
    }
  }

  return taken;
}
