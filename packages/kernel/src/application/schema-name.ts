const CONTEXT_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * The database schema of a bounded context: `order-management` gives `order_management`, a
 * name that needs no quoting.
 */
export function schemaNameOf(context: string): string {
  if (!CONTEXT_NAME.test(context)) {
    throw new TypeError(`Context name "${context}" must be kebab-case`);
  }
  return context.replaceAll('-', '_');
}
