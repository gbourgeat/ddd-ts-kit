import fs from 'node:fs';
import path from 'node:path';
import { STORED_EVENTS_LOCK } from './stored-events-lock-file.js';

/** The stored shapes a project has published: by event name, the fingerprint of each version. Written by `ddd-ts-kit docs`, read by `event-sourcing/upcaster-required`. */
export type StoredEventsLock = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** The lock of the project, empty when there is none or it cannot be read as one. */
export function readStoredEventsLock(root: string): StoredEventsLock {
  let parsed: unknown;

  try {
    parsed = JSON.parse(fs.readFileSync(path.join(root, STORED_EVENTS_LOCK), 'utf8'));
  } catch {
    return {};
  }

  return isRecord(parsed)
    ? Object.fromEntries(
        Object.entries(parsed).map(([name, versions]) => [
          name,
          isRecord(versions)
            ? Object.fromEntries(
                Object.entries(versions).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
              )
            : {},
        ]),
      )
    : {};
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
