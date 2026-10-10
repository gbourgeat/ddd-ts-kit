import { qualified } from './qualified.js';

/** The quoted, qualified name as text, for a statement of a migration, which takes no parameter. */
export function named(schema: string | undefined, name: string): string {
  return qualified(schema, name).strings.join('');
}
