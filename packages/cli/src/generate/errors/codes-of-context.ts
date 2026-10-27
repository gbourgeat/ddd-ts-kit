import { errorCodes } from '../../check/errors/error-codes';
import { scan } from '../../check/scan/scan';
import type { Scope } from '../scope';
import { roleFilesOf, treeOf, type RoleFile } from '../../model-modules';
import { isSharedKernel } from '../is-shared-kernel';

/** Where each code of the error files of a context, or of the shared kernel, is set, as `file:line`. */
export function codesOfContext(scope: Scope): Map<string, string> {
  const taken = new Map<string, string>();

  const files = errorFilesOf(scope).filter(({ name }) => name.endsWith('.error.ts'));

  for (const { path: file } of files) {
    for (const { code, line } of errorCodes(scan(scope.ws.read(file) ?? ''))) {
      if (!taken.has(code)) {
        taken.set(code, `${file}:${line}`);
      }
    }
  }

  return taken;
}

/** The files of `domain/errors/` of a context and its modules; the shared kernel keeps its refusals at its root. */
function errorFilesOf(scope: Scope): RoleFile[] {
  if (isSharedKernel(scope)) {
    return scope.ws.list(scope.dir).map((name) => ({ name, path: `${scope.dir}/${name}` }));
  }

  return roleFilesOf(scope.ws, treeOf(scope.config, scope.context.kebab), 'domain/errors');
}
