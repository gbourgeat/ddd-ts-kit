import { isRecord } from './is-record';

/** The commands the entries of one event of `hooks` run (`[{ matcher, hooks: [{ command }] }]`), whatever else they hold. */
export function registeredHookCommands(entries: unknown): string[] {
  const listed: unknown[] = Array.isArray(entries) ? entries : [];

  return listed.flatMap((entry) => {
    const hooks: unknown[] = isRecord(entry) && Array.isArray(entry['hooks']) ? entry['hooks'] : [];

    return hooks.flatMap((hook) => (isRecord(hook) && typeof hook['command'] === 'string' ? [hook['command']] : []));
  });
}
