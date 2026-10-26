import { renderTemplate, type RenderContext } from '../templating';
import type { Scope } from '../generate/scope';
import { platformPath } from '../generate/platform-path';

/**
 * With tenants, the organisations are the tenants, so the directory a job declared `per-tenant`
 * asks at each occurrence reads them from the database: the file `init` wrote, which reads the
 * fixed list of `TENANTS`, is replaced by one over the adapter of the context. A project without
 * tenancy has no such file and keeps none.
 */
export function organisationsAsTenantDirectory(scope: Scope, rendering: RenderContext): void {
  const file = platformPath(scope, 'composition/tenant-directory.ts');

  if (scope.config.stack.tenancy === 'none' || !scope.ws.exists(file)) {
    return;
  }

  scope.ws.update(file, renderTemplate('presets/identity/platform/tenant-directory.ts.tpl', rendering));
}
