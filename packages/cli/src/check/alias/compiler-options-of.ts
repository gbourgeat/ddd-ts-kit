import path from 'node:path';
import type { Project } from '../model/project';
import { isRecord } from '../support/is-record';
import { parseJsonc } from './parse-jsonc';
import { readProjectFile } from './read-project-file';

const DEPTH = 8;

/**
 * The compiler options of a tsconfig of the project with those it extends, from files of the
 * project or from a package installed at its root, the nearest winning; nothing when the file is
 * absent. `rootDir` and `outDir` are answered from the project root.
 */
export function compilerOptionsOf(
  project: Pick<Project, 'root'>,
  file: string,
  depth = DEPTH,
): Record<string, unknown> | undefined {
  const text = readProjectFile(project, file);
  const written = text === undefined ? undefined : parseJsonc(text);

  if (written === undefined || depth === 0) {
    return undefined;
  }

  const inherited = parentsOf(written['extends']).map(
    (parent) => compilerOptionsOf(project, extended(project, file, parent), depth - 1) ?? {},
  );

  const own = isRecord(written['compilerOptions']) ? written['compilerOptions'] : {};

  return [...inherited, fromRoot(own, path.posix.dirname(file))].reduce(
    (merged, options) => ({ ...merged, ...options }),
    {},
  );
}

function parentsOf(extended: unknown): string[] {
  const listed: unknown[] = Array.isArray(extended) ? extended : [extended];

  return listed.filter((parent) => typeof parent === 'string');
}

/**
 * The file an `extends` names, as the compiler finds it: a relative path as written, or completed
 * with `.json`; anything else is a package, read in the `node_modules` of the project root as a
 * file, a file without its `.json`, or a directory that holds a tsconfig.json. A package found
 * through its `exports`, or in a `node_modules` above the root, is not followed.
 */
function extended(project: Pick<Project, 'root'>, file: string, parent: string): string {
  const named = parent.startsWith('.')
    ? path.posix.join(path.posix.dirname(file), parent)
    : path.posix.join('node_modules', parent);

  const candidates = [named, `${named}.json`, ...(parent.startsWith('.') ? [] : [`${named}/tsconfig.json`])];

  return candidates.find((candidate) => readProjectFile(project, candidate) !== undefined) ?? named;
}

function fromRoot(options: Record<string, unknown>, directory: string): Record<string, unknown> {
  const placed = ['rootDir', 'outDir'].flatMap((key): [string, string][] => {
    const value = options[key];

    return typeof value === 'string' ? [[key, path.posix.join(directory, value)]] : [];
  });

  return { ...options, ...Object.fromEntries(placed) };
}
