import type { StackOptions } from './stack-options';

/** Every lack of the shared cache at once, naming the flags that were passed, or the flag whose default the value is. */
export function httpCacheMisfit(options: StackOptions, http: string, events: string): string {
  const lacks = [
    ...(http === 'none' ? [{ needs: 'an HTTP framework to put the cache in front of', has: '--http none' }] : []),
    ...(events === 'outbox'
      ? []
      : [{ needs: '--events outbox for its purge requests', has: `--events ${events}${eventsDefaultOf(options)}` }]),
  ];

  return `needs ${lacks.map((lack) => lack.needs).join(' and ')}: this project has ${lacks.map((lack) => lack.has).join(' and ')}`;
}

/** The flag the default of the events followed when --events was not passed: --orm, or --database when the ORM followed it. */
function eventsDefaultOf({ events, orm, database }: StackOptions): string {
  if (events !== undefined) {
    return '';
  }

  if (orm !== undefined) {
    return `, the default of --orm ${orm}`;
  }

  return database === undefined ? '' : `, the default of --database ${database}`;
}
