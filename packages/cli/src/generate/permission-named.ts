import { CliError } from '../cli-error';
import { concept } from './concept';
import type { Scope } from './scope';

const PERMISSION_NAME = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

/** A permission is named in the ubiquitous language, like everything else: `<aggregate>.<action>`. */
export function permissionNamed(scope: Scope, permission: string): string {
  if (!PERMISSION_NAME.test(permission)) {
    throw new CliError(
      `"${permission}" is not a permission name.`,
      'Write it as <aggregate>.<action> in kebab-case, for example --permission invoice.issue.',
    );
  }

  concept(scope, permission.replaceAll('.', ' '), { what: 'permission' });

  return permission;
}
