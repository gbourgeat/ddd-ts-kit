import { aliasRoots } from '../alias';
import type { Config } from '../config';
import { withMovedImports } from '../platform-folders/with-moved-imports';
import { projectSources } from '../refusals/project-sources';
import type { Workspace } from '../workspace';
import type { FileMove } from './file-move';

const EXTENSION = /\.(?:ts|tsx|mts)$/;
const SOURCE = /\.(?:ts|tsx|mts|js|mjs|cjs)$/;

/** What moving files changed. */
export interface FileMoves {
  readonly moved: readonly FileMove[];
  /** The files whose imports now name the new paths, moved ones included. */
  readonly rewritten: readonly string[];
}

/**
 * Moves files and rewrites every import of them under the source root, `test/` and `scripts/`, by
 * alias or relative path, the extension kept as it was written.
 */
export function moveFiles(ws: Workspace, config: Config, moved: readonly FileMove[]): FileMoves {
  const touched = new Set(moved.flatMap((move) => [move.from, move.to]));

  const relocation = {
    roots: aliasRoots(config),
    moved: new Map(moved.map((move) => [move.from.replace(EXTENSION, ''), move.to.replace(EXTENSION, '')])),
  };

  // Every file named moves, whatever its kind; only a source has imports to follow.
  const rewrittenMoved = moved.flatMap((move) => {
    const content = ws.read(move.from) ?? '';
    const next = SOURCE.test(move.from) ? withMovedImports(content, move.from, relocation) : content;

    ws.delete(move.from);
    ws.writeAsIs(move.to, next);

    return next === content ? [] : [move.to];
  });

  const rewrittenOthers = projectSources(ws, config, ['scripts'])
    .filter((file) => !touched.has(file))
    .flatMap((file) => {
      const source = ws.read(file) ?? '';
      const next = withMovedImports(source, file, relocation);

      if (next === source) {
        return [];
      }

      ws.writeAsIs(file, next);

      return [file];
    });

  return { moved, rewritten: [...rewrittenMoved, ...rewrittenOthers] };
}
