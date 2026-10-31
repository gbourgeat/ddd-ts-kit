import type { Alongside } from './concept-role';
import { PERMISSION_NAME } from './permission-name';

/**
 * The permission of a request as a name judged with the use case that requires it, so that one
 * refusal lists the words of both; none when there is no well-formed permission.
 */
export function permissionWords(permission: string | undefined): readonly Alongside[] {
  return permission !== undefined && PERMISSION_NAME.test(permission)
    ? [{ words: permission.replaceAll('.', ' '), what: 'permission', label: `the permission "${permission}"` }]
    : [];
}
