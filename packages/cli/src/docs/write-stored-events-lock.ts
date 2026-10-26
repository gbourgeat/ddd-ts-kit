import { readStoredEventsLock } from '../check/event-sourcing/read-stored-events-lock';
import { STORED_EVENTS_LOCK } from '../check/event-sourcing/stored-events-lock-file';
import type { Config } from '../config';
import type { Workspace } from '../workspace';
import { declaredStoredEvents } from './declared-stored-events';
import { refuseUnreadableStoredEvents } from './refuse-unreadable-stored-events';

/**
 * `ddd-ts-kit docs --stored-events`: records in `stored-events.lock.json` the shape of each
 * version of a stored event declared in the codecs of `infrastructure/persistence/`, of the context and of each module of its model. Run when a
 * version starts being stored where events are kept (before the release that ships it): from
 * then on its shape is the one stored. A version already recorded is never rewritten, so a
 * changed shape stays visible to `event-sourcing/upcaster-required`, save the fingerprint 0.82.0
 * and earlier recorded for the same shape, recorded again as it reads now; a project without
 * stored events gets no lock. A codec whose data type is not found or declares no member is refused, with
 * its file and the reason, and nothing is recorded: the hash of nothing would vouch for no shape. `docs --check` fails while a declared version is not recorded.
 */
export function writeStoredEventsLock(ws: Workspace, config: Config, contexts: readonly string[]): void {
  const declared = declaredStoredEvents(ws, config, contexts);

  refuseUnreadableStoredEvents(declared);
  const recorded = readStoredEventsLock(ws.root);
  const exists = ws.exists(STORED_EVENTS_LOCK);

  if (declared.length === 0 && !exists) {
    return;
  }

  const lock: Record<string, Record<string, string>> = Object.fromEntries(
    Object.entries(recorded).map(([name, versions]) => [name, { ...versions }]),
  );

  for (const { name, version, fingerprint, formerFingerprint } of declared) {
    if (name !== undefined && version !== undefined && fingerprint !== undefined) {
      const kept = lock[name]?.[String(version)];

      lock[name] = { ...lock[name], [String(version)]: fingerprintToKeep(kept, { fingerprint, formerFingerprint }) };
    }
  }

  const text = `${JSON.stringify(sorted(lock), null, 2)}\n`;

  if (exists) {
    ws.update(STORED_EVENTS_LOCK, text);
  } else {
    ws.create(STORED_EVENTS_LOCK, text);
  }
}

/** What a version keeps: the fingerprint it was recorded with, but one of the reading of 0.82.0 and earlier, read again. */
function fingerprintToKeep(
  kept: string | undefined,
  declared: { fingerprint: string; formerFingerprint: string | undefined },
): string {
  return kept === undefined || kept === declared.formerFingerprint ? declared.fingerprint : kept;
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
