import type { Name } from '../../naming/index.js';
import { isDeclared } from '../is-declared.js';
import type { Scope } from '../scope.js';

/**
 * The in-memory adapter of the read port. Declared, it is a role file bound by its own
 * decorator, so it carries the repository suffix.
 */
export function readerFile(scope: Scope, name: Name): string {
  return isDeclared(scope.config) ? `in-memory-${name.kebab}-reader.repository` : `in-memory-${name.kebab}.reader`;
}
