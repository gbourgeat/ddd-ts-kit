import path from 'node:path';
import type { Project } from '../model/project.js';
import { isRecord } from '../support/is-record.js';
import { parseJsonc } from './parse-jsonc.js';
import { readProjectFile } from './read-project-file.js';

const DEPTH = 8;

/**
 * The compiler options of a tsconfig of the project with those it extends from files of the
 * project, the nearest winning; nothing when the file is absent. `rootDir` and `outDir` are
 * answered from the project root.
 */
export function compilerOptionsOf(project: Project, file: string, depth = DEPTH): Record<string, unknown> | undefined {
  const text = readProjectFile(project, file);
  const written = text === undefined ? undefined : parseJsonc(text);

  if (written === undefined || depth === 0) {
    return undefined;
  }

  const inherited = parentsOf(written['extends'])
    .filter((parent) => parent.startsWith('.'))
    .map((parent) => compilerOptionsOf(project, path.posix.join(path.posix.dirname(file), parent), depth - 1) ?? {});

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

function fromRoot(options: Record<string, unknown>, directory: string): Record<string, unknown> {
  const placed = ['rootDir', 'outDir'].flatMap((key): [string, string][] => {
    const value = options[key];

    return typeof value === 'string' ? [[key, path.posix.join(directory, value)]] : [];
  });

  return { ...options, ...Object.fromEntries(placed) };
}
