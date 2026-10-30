import { CliError } from '../cli-error';
import { PERMISSION_NAME } from './permission-name';
import { permissionWords } from './permission-words';
import { concept } from './concept';
import type { Scope } from './scope';

/** A permission is named in the ubiquitous language, like everything else: `<aggregate>.<action>`. */
export function permissionNamed(scope: Scope, permission: string): string {
  if (!PERMISSION_NAME.test(permission)) {
    throw new CliError(
      `"${permission}" is not a permission name.`,
      'Write it as <aggregate>.<action> in kebab-case, for example --permission invoice.issue.',
    );
  }

  concept(scope, permissionWords(permission).join(' '), { what: 'permission' });

  return permission;
}
