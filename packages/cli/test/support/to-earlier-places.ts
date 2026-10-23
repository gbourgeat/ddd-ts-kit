import { readConfig } from '../../src/config';
import { CONTEXT_FILES } from '../../src/context-files';
import { moveFiles } from '../../src/file-moves';
import { Workspace } from '../../src/workspace';

/** Puts the code list and the permission set of contexts back where 0.86 and 0.87 wrote them, every import of them with them. */
export function toEarlierPlaces(root: string, contexts: readonly string[]): void {
  const ws = new Workspace(root, false);
  const { config } = readConfig(root);

  const moves = contexts
    .flatMap((context) =>
      CONTEXT_FILES.map((file) => ({
        from: `${config.contextsDir}/${context}/${file.root(context)}`,
        to: `${config.contextsDir}/${context}/${file.earlier(context)}`,
      })),
    )
    .filter((move) => ws.exists(move.from));

  moveFiles(ws, config, moves);
  ws.commit(false);
}
