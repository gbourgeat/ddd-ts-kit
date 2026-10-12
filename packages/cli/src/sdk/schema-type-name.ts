import { CLIENT_NAMES } from './client-names.js';

/** Names the file of the schemas uses for itself, and those of the rest of the client: a component named so would hide them, or clash with them. */
const RESERVED: ReadonlySet<string> = new Set(['Array', 'Record', ...CLIENT_NAMES]);

/** The name of the type of a component schema: its name with what an identifier cannot hold replaced by `_`. */
export function schemaTypeName(component: string): string {
  const name = component.replace(/[^\w$]/g, '_').replace(/^(\d)/, '_$1');

  return RESERVED.has(name) ? `${name}_` : name;
}
