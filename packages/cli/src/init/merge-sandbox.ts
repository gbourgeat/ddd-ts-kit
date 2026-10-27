import { isRecord } from './is-record';

/**
 * The keys of the block a project already has win, key by key, one level down: a project that
 * set a key otherwise keeps its value. A list of paths or hosts is joined instead, the project's
 * entries first: a project that allowed one more host keeps it, and gains the ones the profile
 * adds beside it, such as the cache of an ORM chosen later.
 */
export function mergeSandbox(existing: unknown, profile: Record<string, unknown>): Record<string, unknown> {
  const current = isRecord(existing) ? existing : {};

  return Object.fromEntries(
    keysOf(profile, current).map((key) => {
      const held = current[key];
      const wanted = profile[key];

      return [
        key,
        isRecord(held) && isRecord(wanted)
          ? Object.fromEntries(keysOf(wanted, held).map((inner) => [inner, joined(held[inner], wanted[inner])]))
          : (held ?? wanted),
      ];
    }),
  );
}

function keysOf(profile: Record<string, unknown>, current: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(profile), ...Object.keys(current)])];
}

function joined(held: unknown, wanted: unknown): unknown {
  if (!strings(held) || !strings(wanted)) {
    return held ?? wanted;
  }

  return [...held, ...wanted.filter((entry) => !held.includes(entry))];
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
