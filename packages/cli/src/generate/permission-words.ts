import { PERMISSION_NAME } from './permission-name';

/** The permission of a request as the words it is judged by, for a refusal that lists them with those of the use case; none when there is no well-formed permission. */
export function permissionWords(permission: string | undefined): readonly string[] {
  return permission !== undefined && PERMISSION_NAME.test(permission) ? [permission.replaceAll('.', ' ')] : [];
}
