import { EMPTY_SHAPE_FINGERPRINT } from '../check/event-sourcing/read-stored-shape';
import { readStoredEventsLock } from '../check/event-sourcing/read-stored-events-lock';

/**
 * What `docs --check` holds against `stored-events.lock.json` besides the unrecorded versions: each version
 * recorded with the hash of nothing, as `<event name> version <n>`. That lock vouches for no shape.
 */
export function emptilyRecordedStoredEvents(root: string): string[] {
  return Object.entries(readStoredEventsLock(root)).flatMap(([name, versions]) =>
    Object.entries(versions)
      .filter(([, fingerprint]) => fingerprint === EMPTY_SHAPE_FINGERPRINT)
      .map(([version]) => `${name} version ${version}`),
  );
}
