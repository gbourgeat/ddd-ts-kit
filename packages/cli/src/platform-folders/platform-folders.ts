import { aliasRoots } from '../alias';
import { movedBaselineText } from '../check/baseline/moved-baseline-text';
import { BASELINE_FILE } from '../check/baseline/read-baseline';
import type { Config } from '../config';
import type { MigrationDraft } from '../refusals/migration-draft';
import { projectSources } from '../refusals/project-sources';
import type { Workspace } from '../workspace';
import type { FolderMove } from './folder-move';
import { platformMoves } from './platform-moves';
import { unknownFlatFiles } from './unknown-flat-files';
import { withMovedImports } from './with-moved-imports';

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
  /** The folder of each file of the team, both by their path from the platform. */
  readonly placed?: ReadonlyMap<string, string>;
}

/**
 * Takes the files a project generated before the folders of the platform to the folder of what
 * each answers (`composition/`, `observability/`, `jobs/`, `auth/authentication/`,
 * `auth/authorization/`, the folder of the model, `audit/search-audit-entries/`), rewrites every
 * import of them under the source root, `test/` and `scripts/`, and the paths the scripts of
 * package.json name. A file the kit did not write in a directory that holds folders only stays
 * where it is, said in `draft.manual`, unless `placed` gives it a folder.
 */
export function platformFolders(tree: Tree, draft: MigrationDraft): PlatformFolders {
  const moves = platformMoves(tree.ws, tree.config, tree.placed);
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

  rewriteScripts(draft, moves);
  followInBaseline(draft, moves);

  const platform = `${tree.config.platformDir}/`;

  const left = unknownFlatFiles(tree.ws, tree.config).filter(
    (file) => !moves.some(({ from }) => from === `${platform}${file}`),
  );

  if (left.length > 0) {
    draft.manual.push(leftFlat(left));
  }

  return { moved: moves, rewritten };
}

/** `dev` preloads the tracing module by its path: the scripts name it where it is now. */
/** The errors the baseline of the project records for a moved file follow it to its new path. */
function followInBaseline(draft: MigrationDraft, moves: readonly FolderMove[]): void {
  const baseline = movedBaselineText(draft.read(BASELINE_FILE), moves);

  if (baseline !== undefined) {
    draft.write(BASELINE_FILE, baseline);
  }
}

function rewriteScripts(draft: MigrationDraft, moves: readonly FolderMove[]): void {
  const manifest = draft.read('package.json');

  if (manifest !== undefined) {
    draft.write(
      'package.json',
      moves.reduce((text, { from, to }) => text.replaceAll(`./${from}`, `./${to}`), manifest),
    );
  }
}

function leftFlat(files: readonly string[]): string {
  return `Not written by the kit, left where folders only belong: ${files.join(', ')}. Give each the folder of what it answers, \`--place <file>=<folder>\` once per file, both from the platform (\`--place auth/role-grants.ts=auth/roles\`), in this run or the next: its imports follow.`;
}
