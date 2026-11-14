import { resolveImport } from '../check/project/resolve-import';
import type { Config } from '../config';

/** An import of a file of the platform: the file that imports, what it imports, and the context asked about. */
interface ImportedSource {
  /** The file that holds the import, from the project root. */
  readonly from: string;
  readonly source: string;
  readonly context: string;
}

/**
 * Whether a module specifier leads into a context: a file under its directory, its tables file
 * included, or the barrel a team wrote for it (`@/contexts/shipping`). The specifier is resolved as
 * the project resolves it: a package that bears the name of a context (`@ddd-ts-kit/kernel` beside
 * a context `kernel`) is no file of that context.
 */
export function isSourceOfContext(config: Config, { from, source, context }: ImportedSource): boolean {
  const target = resolveImport(config, from, source);
  const directory = `${config.contextsDir}/${context}`;

  return target.kind === 'file' && (target.path.startsWith(`${directory}/`) || target.path === `${directory}.ts`);
}
