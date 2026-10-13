import { readStoredEventsLock } from '../check/event-sourcing/read-stored-events-lock.js';
import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import { declaredStoredEvents } from './declared-stored-events.js';

/**
 * What `docs --check` holds against `stored-events.lock.json`: each version of a stored event
 * declared in a codec and not recorded yet, as `<event name> version <n>`. Until a version is
 * recorded, `event-sourcing/upcaster-required` has nothing to compare its shape with.
 */
export function unrecordedStoredEvents(ws: Workspace, config: Config, contexts: readonly string[]): string[] {
  const recorded = readStoredEventsLock(ws.root);

  return declaredStoredEvents(ws, config, contexts).flatMap(({ name, version, fingerprint }) =>
    name !== undefined &&
    version !== undefined &&
    fingerprint !== undefined &&
    recorded[name]?.[String(version)] === undefined
      ? [`${name} version ${version}`]
      : [],
  );
}
