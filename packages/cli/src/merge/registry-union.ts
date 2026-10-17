import { mergeImports } from '../markers/merge-imports.js';
import type { ConflictBlock } from './conflict-blocks.js';

/** A whole import statement on one line, or a blank line: what the imports region merges by statement. */
const ONE_LINE_IMPORT = /^\s*(?:import\s.+;\s*)?$/;

/**
 * The lines of a conflict inside a generated registry, merged as sets: the base without what
 * either side removed, plus what each side added, ours first, each line once. In the `imports`
 * region, names imported from one module by both sides end up in one statement.
 */
export function registryUnion(block: ConflictBlock, region: string): string[] {
  const { ours, base, theirs } = block;
  const removedByTheirs = new Set(base.filter((line) => !theirs.includes(line)));
  const kept = unique(ours.filter((line) => !removedByTheirs.has(line)));
  const added = unique(theirs.filter((line) => !base.includes(line) && !kept.includes(line)));

  if (region === 'imports' && [...ours, ...base, ...theirs].every((line) => ONE_LINE_IMPORT.test(line))) {
    return mergeImports(
      kept.filter((line) => line.trim() !== ''),
      added.filter((line) => line.trim() !== ''),
    );
  }

  return [...kept, ...added];
}

function unique(lines: readonly string[]): string[] {
  return lines.filter((line, index) => line.trim() === '' || lines.indexOf(line) === index);
}
