import { isRecord } from '../check/support/is-record.js';
import type { MIGRATION_TARGETS } from './migration-targets.js';

/**
 * The form a plan file moves the project to: its `to`. A plan without one was written before the
 * named form existed, for the move to factories; no plan at all is read as the default move.
 */
export function planTarget(text: string | undefined): (typeof MIGRATION_TARGETS)[number] {
  if (text === undefined) {
    return 'named';
  }

  const raw: unknown = JSON.parse(text);

  return isRecord(raw) && raw['to'] === 'named' ? 'named' : 'factories';
}
