import { isRecord } from './is-record.js';

/**
 * The keys of the block a project already has win, key by key, one level down: a project that
 * allowed one more host keeps it, and gains what the profile adds beside it.
 */
export function mergeSandbox(existing: unknown, profile: Record<string, unknown>): Record<string, unknown> {
  const current = isRecord(existing) ? existing : {};

  return Object.fromEntries(
    [...new Set([...Object.keys(profile), ...Object.keys(current)])].map((key) => [
      key,
      isRecord(current[key]) && isRecord(profile[key])
        ? { ...profile[key], ...current[key] }
        : (current[key] ?? profile[key]),
    ]),
  );
}
