import type { Name } from '../naming/index.js';
import { renderTemplate } from '../templating/index.js';
import { applyWiring } from './apply-wiring.js';
import { permissionsFile } from './permissions-file.js';
import type { Scope } from './scope.js';
import { vars } from './vars.js';

/** Adds a permission to the permissions of the context, which are born with their first one. */
export function declarePermission(scope: Scope, permission: string, useCase: Name): void {
  const file = `${scope.dir}/${permissionsFile(scope.context)}`;
  const context = vars(scope, { access: { permission, description: useCase.title } });

  if (!scope.ws.exists(file)) scope.ws.create(file, renderTemplate('context/permissions.ts.tpl', context));
  if ((scope.ws.read(file) ?? '').includes(`'${permission}':`)) return;

  applyWiring(scope.ws, file, renderTemplate('context/permission.tpl', context));
}
