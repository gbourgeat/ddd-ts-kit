import type { ContextFacts } from './context-facts';
import { personalTableCells } from './personal-table-cells';
import type { PersonalTableFacts } from './personal-table-facts';

/**
 * The personal data of a context as its CONTEXT.md lists it: one row per declared table, then
 * the integration events whose payload carries some, which is where it leaves the context.
 */
export function personalDataLines(facts: Pick<ContextFacts, 'personalData' | 'publishedEvents'>): string[] {
  const leaving = facts.publishedEvents.flatMap((event) =>
    event.personal === undefined
      ? []
      : [
          `- \`${event.type}\` (version ${String(event.version)}): ${event.personal.fields.map((field) => `\`${field}\``).join(', ')}, about \`${event.personal.subject}\``,
        ],
  );

  if (facts.personalData.length === 0 && leaving.length === 0) {
    return ['No personal data declared.'];
  }

  return [...tableLines(facts.personalData), ...(leaving.length === 0 ? [] : ['', 'Published in:', '', ...leaving])];
}

function tableLines(tables: readonly PersonalTableFacts[]): string[] {
  if (tables.length === 0) {
    return ['No table declares personal data.'];
  }

  return [
    '| Table | About | Personal data | On erasure | Kept |',
    '|---|---|---|---|---|',
    ...tables
      .map(personalTableCells)
      .map((row) => `| ${row.table} | ${row.subject} | ${row.kept} | ${row.erasure} | ${row.retention} |`),
  ];
}
