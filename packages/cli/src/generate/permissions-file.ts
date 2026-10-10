import type { Name } from '../naming/index.js';

/** The file holding the permissions of a context, relative to the context. */
export function permissionsFile(context: Name): string {
  return `application/authorization/${context.kebab}.permissions.ts`;
}
