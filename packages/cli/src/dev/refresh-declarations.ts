import { findRoot } from '../commands/find-root.js';
import { readConfig } from '../config/index.js';
import { refreshBarrels } from '../generate/refresh-barrels.js';
import { Workspace } from '../workspace/index.js';

/**
 * Rewrites the generated file of every declared context of the project around `start` from
 * its role files and its constructor signatures, and tells what it rewrote. It is what the
 * `dev` script loads before the application, on every restart of the watcher: a dependency
 * added to a constructor is injected on the reload that follows the save. A failure is told
 * and never thrown: the composition root then refuses a class left without a list, by name.
 */
export function refreshDeclarations(start: string, tell: (line: string) => void): readonly string[] {
  try {
    const root = findRoot(start);
    const ws = new Workspace(root, false);

    refreshBarrels(ws, readConfig(root).config);

    const { created, updated, notes } = ws.commit(false);
    const rewritten = [...created, ...updated];

    rewritten.forEach((file) => tell(`ddd-ts-kit: rewrote ${file} from the role files and their constructors`));
    notes.forEach((note) => tell(`ddd-ts-kit: ${note}`));

    return rewritten;
  } catch (error) {
    tell(
      `ddd-ts-kit: the generated declarations were not refreshed: ${error instanceof Error ? error.message : String(error)}`,
    );

    return [];
  }
}
