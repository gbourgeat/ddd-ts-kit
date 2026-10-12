import { readStoredEventsLock } from '../check/event-sourcing/read-stored-events-lock.js';
import type { StoredEventDeclaration } from '../check/event-sourcing/stored-event-declaration.js';
import { storedEventDeclarations } from '../check/event-sourcing/stored-event-declarations.js';
import { STORED_EVENTS_LOCK } from '../check/event-sourcing/stored-events-lock-file.js';
import type { Config } from '../config/index.js';
import { workspaceSources } from '../generate/workspace-sources.js';
import type { Workspace } from '../workspace/index.js';

/**
 * `ddd-ts-kit docs --stored-events`: records in `stored-events.lock.json` the shape of each
 * version of a stored event declared in the codecs of `infrastructure/persistence/`. Run when a
 * version starts being stored where events are kept (before the release that ships it): from
 * then on its shape is the one stored. A version already recorded is never rewritten, so a
 * changed shape stays visible to `event-sourcing/upcaster-required`; a project without stored
 * events gets no lock.
 */
export function writeStoredEventsLock(ws: Workspace, config: Config, contexts: readonly string[]): void {
  const declared = contexts.flatMap((context) => declaredIn(ws, config, context));
  const recorded = readStoredEventsLock(ws.root);
  const exists = ws.exists(STORED_EVENTS_LOCK);

  if (declared.length === 0 && !exists) {
    return;
  }

  const lock: Record<string, Record<string, string>> = Object.fromEntries(
    Object.entries(recorded).map(([name, versions]) => [name, { ...versions }]),
  );

  for (const { name, version, fingerprint } of declared) {
    if (name !== undefined && version !== undefined && fingerprint !== undefined) {
      lock[name] = { [String(version)]: fingerprint, ...lock[name] };
    }
  }

  const text = `${JSON.stringify(sorted(lock), null, 2)}\n`;

  if (exists) {
    ws.update(STORED_EVENTS_LOCK, text);
  } else {
    ws.create(STORED_EVENTS_LOCK, text);
  }
}

function declaredIn(ws: Workspace, config: Config, context: string): StoredEventDeclaration[] {
  const directory = `${config.contextsDir}/${context}/infrastructure/persistence`;
  const sources = workspaceSources(ws, config);

  return ws
    .list(directory)
    .filter((name) => name.endsWith('.ts'))
    .flatMap((name) => {
      const file = sources(`${directory}/${name}`);

      return file === undefined ? [] : storedEventDeclarations(file);
    });
}

function sorted(lock: Record<string, Record<string, string>>): Record<string, Record<string, string>> {
  return Object.fromEntries(
    Object.keys(lock)
      .sort()
      .map((name) => [
        name,
        Object.fromEntries(Object.entries(lock[name] ?? {}).sort(([left], [right]) => Number(left) - Number(right))),
      ]),
  );
}
