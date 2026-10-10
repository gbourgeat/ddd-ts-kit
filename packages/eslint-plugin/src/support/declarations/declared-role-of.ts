import type { LintedFile } from '../../project/linted-file.js';
import type { DeclaredRole } from './declared-role.js';
import { DECLARED_ROLES } from './declared-roles.js';

/** The role a production file of a context plays by its suffix and folder, whatever the style of the project. */
export function declaredRoleOf(file: LintedFile): DeclaredRole | undefined {
  const { location } = file;

  if (location.area !== 'context' || file.isTest || !/(?<!\.d)\.ts$/.test(file.path)) return undefined;

  const inContext = [location.layer, ...location.inside].join('/');
  const stem = inContext.slice(0, -'.ts'.length);

  return DECLARED_ROLES.find((role) => stem.endsWith(`.${role.suffix}`) && role.folders.some((folder) => inContext.startsWith(`${folder}/`)));
}
