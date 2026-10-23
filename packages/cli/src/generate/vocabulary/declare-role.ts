import { specifierOf } from '../../alias';
import type { Scope } from '../scope';
import { entriesOf } from './entries-of';
import { vocabularyText } from './vocabulary-text';
import { platformPath } from '../platform-path';

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
  const file = platformPath(scope, 'auth/authorization/role.ts');
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
