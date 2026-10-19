import { specifierOf } from '../../alias/index.js';
import type { Scope } from '../scope.js';
import { entriesOf } from './entries-of.js';
import { vocabularyText } from './vocabulary-text.js';
import { authFile } from '../auth-file.js';

/** The key of a role in the role vocabulary of the platform, and the specifier that imports it. */
export interface DeclaredRole {
  readonly key: string;
  readonly specifier: string;
}

/**
 * The role a guard requires, read from `<platformDir>/auth/authorization/role.ts`, the one place the names of
 * the roles a credential carries are written: added there when the vocabulary does not hold it,
 * and the file written when the project has none yet.
 */
export function declareRole(scope: Scope, role: string): DeclaredRole {
  const file = authFile(scope, 'role.ts');
  const entries = entriesOf([role]);
  const existing = scope.ws.read(file);
  const text = vocabularyText('Role', entries, existing);

  if (existing === undefined) {
    scope.ws.create(file, text);
  } else {
    scope.ws.update(file, text);
  }

  return { key: entries[0]?.key ?? '', specifier: specifierOf(scope.config, file) };
}
