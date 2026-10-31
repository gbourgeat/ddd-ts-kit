/**
 * A file a context holds once, whatever its modules: at the root of the context, named after it,
 * and still read where 0.86 and 0.87 wrote it, in a role folder, so that `context-layout` moves it.
 */
export interface ContextFile {
  /** The file at the root of the context, relative to it: `billing.codes.ts`. */
  readonly root: (context: string) => string;
  /** Where 0.86 and 0.87 wrote it, relative to the context: `domain/errors/codes.ts`. */
  readonly earlier: (context: string) => string;
}

/** The closed list of the codes of the refusals of a context. */
export const CODES_FILE: ContextFile = {
  root: (context) => `${context}.codes.ts`,
  earlier: () => 'domain/errors/codes.ts',
};

/** The permission set of a context. */
export const PERMISSIONS_FILE: ContextFile = {
  root: (context) => `${context}.permissions.ts`,
  earlier: (context) => `application/authorization/${context}.permissions.ts`,
};

export const CONTEXT_FILES: readonly ContextFile[] = [CODES_FILE, PERMISSIONS_FILE];
