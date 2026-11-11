import { specifierOf } from '../../../alias';
import { platformPath } from '../../platform-path';
import type { Scope } from '../../scope';
import { heldEntries } from '../../vocabulary/held-entries';

/** The role an end-to-end spec gives its actor, as the spec writes it, and the import it needs. */
export interface ActingRole {
  /** `Role.Admin` where the platform declares its roles, `'admin'` where it declares none. */
  readonly written: string;
  /** The import of the role vocabulary; empty when the role is written as a string. */
  readonly roleImport: string;
}

const ADMIN = 'admin';

/**
 * The role the actor of an end-to-end spec holds: the administrator of the role vocabulary of the
 * platform (`auth/authorization/role.ts`), or its first role when it names no administrator, written
 * `Role.<Key>` so that the compiler checks it. A platform without that vocabulary gets the string.
 */
export function actingRole(scope: Scope): ActingRole {
  const file = platformPath(scope, 'auth/authorization/role.ts');
  const entries = heldEntries(scope.ws.read(file) ?? '');
  const role = entries.find(({ value }) => value === ADMIN) ?? entries[0];

  if (role === undefined) {
    return { written: `'${ADMIN}'`, roleImport: '' };
  }

  return { written: `Role.${role.key}`, roleImport: `import { Role } from '${specifierOf(scope.config, file)}';` };
}
