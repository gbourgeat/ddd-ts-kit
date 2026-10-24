import type { ContextFacts } from './context-facts';
import { personalTableCells } from './personal-table-cells';

/**
 * The generated part of `docs/privacy/register.md`: what the system knows of a person, table by
 * table across the contexts, and where it leaves its context in an integration event.
 */
export function privacyRegisterLines(
  contexts: readonly Pick<ContextFacts, 'name' | 'personalData' | 'publishedEvents' | 'downstreams'>[],
): string[] {
  const tables = contexts.flatMap((context) =>
    context.personalData
      .map(personalTableCells)
      .map(
        (row) =>
          `| ${context.name} | ${row.table} | ${row.subject} | ${row.kept} | ${row.erasure} | ${row.retention} |`,
      ),
  );

  const events = contexts.flatMap((context) =>
    context.publishedEvents.flatMap(({ type, version, personal }) =>
      personal === undefined
        ? []
        : [
            `| \`${type}\` (version ${String(version)}) | ${context.name} | \`${personal.subject}\` | ${personal.fields.map((field) => `\`${field}\``).join(', ')} | ${downstreamOf(context)} |`,
          ],
    ),
  );

  return [
    '## What the system knows of a person',
    '',
    ...(tables.length === 0
      ? ['No context declares a table that keeps personal data.']
      : ['| Context | Table | About | Personal data | On erasure | Kept |', '|---|---|---|---|---|---|', ...tables]),
    '',
    '## Where it leaves its context',
    '',
    ...(events.length === 0
      ? ['No integration event declares personal data in its payload.']
      : ['| Event | Producer | About | Personal data | Downstream |', '|---|---|---|---|---|', ...events]),
  ];
}

/** The contexts that declare the producer upstream: the ones its events may reach. */
function downstreamOf(context: Pick<ContextFacts, 'downstreams'>): string {
  const names = context.downstreams.map((downstream) => downstream.context);

  return names.length === 0 ? 'none declared' : [...new Set(names)].sort().join(', ');
}
