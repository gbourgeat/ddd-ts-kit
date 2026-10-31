/** The database schemas the datasource of a main schema file lists, in their order. */
export function datasourceSchemas(text: string): string[] {
  return [...(/schemas\s*=\s*\[([^\]]*)\]/.exec(text)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map(
    ([, schema = '']) => schema,
  );
}
