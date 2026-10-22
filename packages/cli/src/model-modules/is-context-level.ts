/**
 * The files of `domain/` and `application/` that stay one per context once it is divided into
 * modules, by their path relative to the context: the closed list of its error codes and its
 * permission set. A role folder holding only them stays at the level of the context.
 */
export function isContextLevel(context: string, file: string): boolean {
  return file === 'domain/errors/codes.ts' || file === `application/authorization/${context}.permissions.ts`;
}
