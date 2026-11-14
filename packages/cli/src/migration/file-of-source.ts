/** The name of the file a module specifier leads to, without its extension. */
export function fileOfSource(source: string): string {
  return source.replace(/\.[jt]s$/, '').replace(/^.*\//, '');
}
