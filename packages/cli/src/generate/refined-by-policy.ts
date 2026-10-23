import { filesUnder } from './files-under';
import { permissionPattern } from './permission-pattern';
import type { Scope } from './scope';

const POLICY_FILE = /^application\/authorization\/[^/]+\.policy\.ts$/;

/** Whether a policy of the context refines `permission`: its use cases then ask it. */
export function refinedByPolicy(scope: Scope, permission: string): boolean {
  const named = permissionPattern(scope, permission);

  return filesUnder(scope.ws, scope.dir).some(
    (file) => POLICY_FILE.test(file) && named.test(scope.ws.read(`${scope.dir}/${file}`) ?? ''),
  );
}
