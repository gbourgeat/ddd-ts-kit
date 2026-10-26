import type { StoredEventDeclaration } from '../check/event-sourcing/stored-event-declaration';
import { storedEventDeclarations } from '../check/event-sourcing/stored-event-declarations';
import { eventNameResolver } from '../check/events/event-name-resolver';
import type { SourceFile } from '../check/model/source-file';
import type { Config } from '../config';
import { workspaceSources } from '../generate/workspace-sources';
import type { Workspace } from '../workspace';
import { roleFoldersOf, treeOf } from '../model-modules';

/** A stored event declaration with the codec file that holds it. */
export type CodecDeclaration = StoredEventDeclaration & { readonly file: string };

/**
 * The stored events the codecs of `infrastructure/persistence/` of these contexts, and of each module of their model, declare, a key
 * `[<Event>.eventName]` read from the events of `domain/events/`.
 */
export function declaredStoredEvents(ws: Workspace, config: Config, contexts: readonly string[]): CodecDeclaration[] {
  const sources = workspaceSources(ws, config);

  return contexts.flatMap((context) => {
    const eventNameOf = eventNameResolver(
      roleFoldersOf(ws, treeOf(config, context), 'domain/events').flatMap((folder) => sourcesIn(ws, folder, sources)),
    );

    return roleFoldersOf(ws, treeOf(config, context), 'infrastructure/persistence')
      .flatMap((folder) => sourcesIn(ws, folder, sources))
      .flatMap((file) =>
        storedEventDeclarations(file, eventNameOf).map((declaration) => ({ ...declaration, file: file.path })),
      );
  });
}

function sourcesIn(ws: Workspace, directory: string, sources: (path: string) => SourceFile | undefined): SourceFile[] {
  return ws
    .list(directory)
    .filter((name) => name.endsWith('.ts'))
    .flatMap((name) => sources(`${directory}/${name}`) ?? []);
}
