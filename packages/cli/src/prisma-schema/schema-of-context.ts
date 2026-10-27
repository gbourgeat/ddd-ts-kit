/** The database schema of a context, as the generators name it: its name, `-` written `_`. */
export function schemaOfContext(context: string): string {
  return context.replaceAll('-', '_');
}
