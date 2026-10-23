import { readStoredEventsLock } from '../check/event-sourcing/read-stored-events-lock';
import type { Config } from '../config';
import type { Workspace } from '../workspace';
import { declaredStoredEvents } from './declared-stored-events';

/**
 * What `docs --check` holds against `stored-events.lock.json` besides the unrecorded versions: each
 * version recorded with the fingerprint 0.82.0 and earlier gave its shape, as `<event name> version
 * <n>`. That reading could give two shapes one fingerprint, so `docs --stored-events` records it again.
 */
export function formerlyRecordedStoredEvents(ws: Workspace, config: Config, contexts: readonly string[]): string[] {
  const recorded = readStoredEventsLock(ws.root);

  return declaredStoredEvents(ws, config, contexts).flatMap(({ name, version, formerFingerprint }) =>
    name !== undefined &&
    version !== undefined &&
    formerFingerprint !== undefined &&
    recorded[name]?.[String(version)] === formerFingerprint
      ? [`${name} version ${version}`]
      : [],
  );
}
