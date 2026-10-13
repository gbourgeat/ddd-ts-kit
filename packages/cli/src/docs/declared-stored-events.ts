import type { StoredEventDeclaration } from '../check/event-sourcing/stored-event-declaration.js';
import { storedEventDeclarations } from '../check/event-sourcing/stored-event-declarations.js';
import type { Config } from '../config/index.js';
import { workspaceSources } from '../generate/workspace-sources.js';
import type { Workspace } from '../workspace/index.js';

/** The stored events the codecs of `infrastructure/persistence/` of these contexts declare. */
export function declaredStoredEvents(
  ws: Workspace,
  config: Config,
  contexts: readonly string[],
): StoredEventDeclaration[] {
  const sources = workspaceSources(ws, config);

  return contexts.flatMap((context) => {
    const directory = `${config.contextsDir}/${context}/infrastructure/persistence`;

    return ws
      .list(directory)
      .filter((name) => name.endsWith('.ts'))
      .flatMap((name) => {
        const file = sources(`${directory}/${name}`);

        return file === undefined ? [] : storedEventDeclarations(file);
      });
  });
}
