import type { StoredEventDeclaration } from '../check/event-sourcing/stored-event-declaration.js';
import { storedEventDeclarations } from '../check/event-sourcing/stored-event-declarations.js';
import { eventNameResolver } from '../check/events/event-name-resolver.js';
import type { SourceFile } from '../check/model/source-file.js';
import type { Config } from '../config/index.js';
import { workspaceSources } from '../generate/workspace-sources.js';
import type { Workspace } from '../workspace/index.js';
import { roleFoldersOf } from '../model-modules/index.js';

/**
 * The stored events the codecs of `infrastructure/persistence/` of these contexts declare, a key
 * `[<Event>.eventName]` read from the events of `domain/events/`.
 */
export function declaredStoredEvents(
  ws: Workspace,
  config: Config,
  contexts: readonly string[],
): StoredEventDeclaration[] {
  const sources = workspaceSources(ws, config);

  return contexts.flatMap((context) => {
    const root = `${config.contextsDir}/${context}`;

    const eventNameOf = eventNameResolver(
      roleFoldersOf(ws, root, 'domain/events').flatMap((folder) => sourcesIn(ws, folder, sources)),
    );

    return sourcesIn(ws, `${root}/infrastructure/persistence`, sources).flatMap((file) =>
      storedEventDeclarations(file, eventNameOf),
    );
  });
}

function sourcesIn(ws: Workspace, directory: string, sources: (path: string) => SourceFile | undefined): SourceFile[] {
  return ws
    .list(directory)
    .filter((name) => name.endsWith('.ts'))
    .flatMap((name) => sources(`${directory}/${name}`) ?? []);
}
