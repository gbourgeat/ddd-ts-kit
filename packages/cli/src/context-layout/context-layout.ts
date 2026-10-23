import type { Config } from '../config';
import { CONTEXT_FILES } from '../context-files';
import { type FileMove, moveFiles } from '../file-moves';
import type { Workspace } from '../workspace';
import { refreshDocs } from '../generate/refresh-docs';
import { ignoreCodeTypesWhereTheyAre } from '../knip';
import { moduleMoves } from './module-moves';

const KNIP_BY_HAND =
  'knip.json is not plain JSON: tell knip that the code types are a contract where they are now, under "ignoreIssues": `"src/contexts/*/*.codes.ts": ["types"]`.';

/** What bringing the contexts to the layout of this version changed, and what is left to a person. */
export interface ContextLayout {
  readonly moved: readonly FileMove[];
  readonly rewritten: readonly string[];
  readonly manual: readonly string[];
}

/**
 * Brings the contexts named, or every context of the config, to the layout of this version: the
 * code list and the permission set that 0.86 and 0.87 wrote in a role folder move to the root of their
 * context, each module of the model moves to its folder with its adapters, routes and specs
 * (`moduleMoves`), every import of them follows, and what derives from the tree is written again: the
 * import graph rules, the generated declarations, and the code types knip is told of, named where
 * they are. A context that holds both places is left to a person, who keeps the one at the root.
 */
export function contextLayout(ws: Workspace, config: Config, asked: readonly string[]): ContextLayout {
  const contexts = (asked.length > 0 ? asked : Object.keys(config.contexts)).filter((context) =>
    ws.exists(`${config.contextsDir}/${context}`),
  );

  const toTheRoot = contextFileMoves(ws, config, contexts);
  const inModules = contexts.map((context) => moduleMoves(ws, config, context));
  const moved = [...toTheRoot.moves, ...inModules.flatMap((placed) => placed.moves)];
  const { rewritten } = moveFiles(ws, config, moved);

  // What derives from the tree follows the moved files: the import graph rules and the declarations.
  if (moved.length > 0) {
    refreshDocs(ws, 'move');
  }

  // knip is told of the code lists where they are, also when a person moved them.
  const knip = ignoreCodeTypesWhereTheyAre(ws, config);
  const unplaced = inModules.flatMap((placed) => placed.unplaced).map(unplacedLine);
  const taken = inModules.flatMap((placed) => placed.taken).map(takenLine);

  return {
    moved,
    rewritten,
    manual: [...toTheRoot.manual, ...taken, ...unplaced, ...(knip === 'unreadable' ? [KNIP_BY_HAND] : [])],
  };
}

/** The code lists and permission sets of the contexts that move to their root, and the contexts that hold both places. */
function contextFileMoves(
  ws: Workspace,
  config: Config,
  contexts: readonly string[],
): { moves: FileMove[]; manual: string[] } {
  const found = contexts
    .flatMap((context) =>
      CONTEXT_FILES.map((file) => {
        const directory = `${config.contextsDir}/${context}`;

        return { from: `${directory}/${file.earlier(context)}`, to: `${directory}/${file.root(context)}` };
      }),
    )
    .filter((move) => ws.exists(move.from));

  const moves = found.filter((move) => !ws.exists(move.to));

  const manual = found
    .filter((move) => !moves.includes(move))
    .map(
      (move) =>
        `${move.from} and ${move.to} both exist: keep ${move.to}, move into it what the other holds that it lacks, then delete ${move.from}.`,
    );

  return { moves, manual };
}

function takenLine({ from, to }: FileMove): string {
  return `${from} and ${to} both exist: nothing was overwritten. Keep the file of the module, move into it what the other holds that it lacks, delete the other, and run the command again.`;
}

function unplacedLine(file: string): string {
  return `${file} names no module, or two, by what it imports: move it with \`ddd-ts-kit move-to-module <context> <module> <path>\`, or leave it at the level of the context if every module uses it.`;
}
