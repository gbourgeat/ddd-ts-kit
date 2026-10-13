import { specifierOf } from '../../../alias/index.js';
import type { Config } from '../../../config/index.js';
import { toName } from '../../../naming/index.js';
import { permissionsFile } from '../../permissions-file.js';

/** A permission as code reads it: the entry of the permission set of its context, and the import of that set. */
export interface PermissionReference {
  readonly written: string;
  readonly importLine: string;
}

/** `billing:invoice.cancel` is read `billingPermissions['invoice.cancel']`, imported from the permissions file of billing. */
export function permissionOf(config: Config, permission: string): PermissionReference {
  const [context = '', key = ''] = permission.split(':');
  const name = toName(context);
  const set = `${name.camel}Permissions`;
  const file = `${config.contextsDir}/${name.kebab}/${permissionsFile(name)}`;

  return { written: `${set}['${key}']`, importLine: `import { ${set} } from '${specifierOf(config, file)}';` };
}
