/** Names the file of the schemas uses for itself: a component named so would hide them. */
const RESERVED = new Set(['Array', 'Record']);

/** The name of the type of a component schema: its name with what an identifier cannot hold replaced by `_`. */
export function schemaTypeName(component: string): string {
  const name = component.replace(/[^\w$]/g, '_').replace(/^(\d)/, '_$1');

  return RESERVED.has(name) ? `${name}_` : name;
}
