import type { Config } from '../config';
import { CONTEXT_FILES } from '../context-files';
import { type FileMove, moveFiles } from '../file-moves';
import type { Workspace } from '../workspace';
import { refreshDocs } from '../generate/refresh-docs';
import { ignoreCodeTypesWhereTheyAre } from '../knip';

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
 * code list and the permission set that 0.86 wrote in a role folder move to the root of their
 * context, every import of them follows, and what derives from the tree is written again: the
 * import graph rules, the generated declarations, and the code types knip is told of, named where
 * they are. A context that holds both places is left to a person, who keeps the one at the root.
 */
export function contextLayout(ws: Workspace, config: Config, asked: readonly string[]): ContextLayout {
  const contexts = (asked.length > 0 ? asked : Object.keys(config.contexts)).filter((context) =>
    ws.exists(`${config.contextsDir}/${context}`),
  );

  const found = contexts
    .flatMap((context) =>
      CONTEXT_FILES.map((file) => {
        const directory = `${config.contextsDir}/${context}`;

        return { from: `${directory}/${file.earlier(context)}`, to: `${directory}/${file.root(context)}` };
      }),
    )
    .filter((move) => ws.exists(move.from));

  const moves = found.filter((move) => !ws.exists(move.to));
  const { rewritten } = moveFiles(ws, config, moves);

  const manual = found
    .filter((move) => !moves.includes(move))
    .map(
      (move) =>
        `${move.from} and ${move.to} both exist: keep ${move.to}, move into it what the other holds that it lacks, then delete ${move.from}.`,
    );

  // What derives from the tree follows the moved files: the import graph rules and the declarations.
  if (moves.length > 0) {
    refreshDocs(ws, 'move');
  }

  // knip is told of the code lists where they are, also when a person moved them.
  const knip = ignoreCodeTypesWhereTheyAre(ws, config);

  return { moved: moves, rewritten, manual: knip === 'unreadable' ? [...manual, KNIP_BY_HAND] : manual };
}
