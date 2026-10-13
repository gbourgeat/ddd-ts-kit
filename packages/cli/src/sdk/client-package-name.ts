/** The package name of the client of a document: the pattern of "sdk.name" with `{project}` and `{document}` replaced. */
export function clientPackageName(pattern: string, project: string, document: string): string {
  return pattern.replaceAll('{project}', project).replaceAll('{document}', document);
}
