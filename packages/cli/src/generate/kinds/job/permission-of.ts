import { specifierOf } from '../../../alias';
import type { Config } from '../../../config';
import { toName } from '../../../naming';
import { permissionsFile } from '../../permissions-file';

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
