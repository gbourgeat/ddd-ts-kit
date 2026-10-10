import { DECLARED_ROLES, type DeclaredRole } from './declared-role.js';

/** The role of a source given relative to its context, or undefined when the file plays none. */
export function declaredRoleOf(file: string): DeclaredRole | undefined {
  if (!file.endsWith('.ts') || file.endsWith('.d.ts') || file.endsWith('.spec.ts')) return undefined;

  const stem = file.slice(0, -'.ts'.length);

  return DECLARED_ROLES.find((role) => stem.endsWith(`.${role.suffix}`) && role.folders.some((folder) => file.startsWith(`${folder}/`)));
}
