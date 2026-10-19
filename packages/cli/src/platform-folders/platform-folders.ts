import { aliasRoots } from '../alias/index.js';
import type { Config } from '../config/index.js';
import type { MigrationDraft } from '../refusals/migration-draft.js';
import { projectSources } from '../refusals/project-sources.js';
import type { Workspace } from '../workspace/index.js';
import { authMoves } from './auth-moves.js';
import type { FolderMove } from './folder-move.js';
import { unknownAuthFiles } from './unknown-auth-files.js';
import { withMovedImports } from './with-moved-imports.js';

const EXTENSION = /\.(?:ts|js)$/;

/** What taking the files of the platform to their folders changed. */
export interface PlatformFolders {
  readonly moved: readonly FolderMove[];
  /** The files whose imports now name the new paths, moved ones included. */
  readonly rewritten: readonly string[];
}

interface Tree {
  readonly ws: Workspace;
  readonly config: Config;
  /** The folder of each file of the team, by its name in `auth/`. */
  readonly placed?: ReadonlyMap<string, string>;
}

/**
 * Takes the files a project generated before the folders of the platform to the folder of the
 * question each answers (`auth/authentication/`, `auth/authorization/`, the folder of the model),
 * and rewrites every import of them under the source root, `test/` and `scripts/`. A file the kit
 * did not write stays where it is, said in `draft.manual`, unless `placed` gives it a folder.
 */
export function platformFolders(tree: Tree, draft: MigrationDraft): PlatformFolders {
  const moves = authMoves(tree.ws, tree.config, tree.placed);
  const moved = new Map(moves.map(({ from, to }) => [from.replace(EXTENSION, ''), to.replace(EXTENSION, '')]));
  const relocation = { roots: aliasRoots(tree.config), moved };
  const rewritten: string[] = [];

  for (const file of projectSources(tree.ws, tree.config, ['scripts'])) {
    const source = draft.read(file) ?? '';
    const next = withMovedImports(source, file, relocation);
    const target = moves.find(({ from }) => from === file)?.to ?? file;

    if (target !== file) {
      draft.remove(file);
      draft.write(target, next);
    } else if (next !== source) {
      draft.write(file, next);
    }

    if (next !== source) {
      rewritten.push(target);
    }
  }

  const left = unknownAuthFiles(tree.ws, tree.config).filter((file) => !moves.some(({ from }) => from === file));

  if (left.length > 0) {
    draft.manual.push(leftFlat(left));
  }

  return { moved: moves, rewritten };
}

function leftFlat(files: readonly string[]): string {
  const names = files.map((file) => file.slice(file.lastIndexOf('/') + 1));

  return `Not written by the kit, left flat: ${names.join(', ')}. Give each the folder of what it answers, \`--place <file>=<folder>\` once per file, in this run or the next: its imports follow.`;
}
