import type { CitationsAtRef } from '../citations/stale-names-at';

/** What the conductor reads before launching a worker whose design cites names the trunk does not have. */
export function designNote({ base, citations }: CitationsAtRef): string[] {
  if (citations.length === 0) {
    return [];
  }

  const rows = [...new Set(citations.flatMap((citation) => citation.rows))].map((id) => `#${id}`).join(', ');
  const documents = [...new Set(citations.map((citation) => citation.document))];

  const places = documents
    .map((document) => {
      const lines = citations.filter((citation) => citation.document === document).map((citation) => citation.line);

      return `${document}:${[...new Set(lines)].join(', :')}`;
    })
    .join('; ');

  const count = `${citations.length} name${citations.length === 1 ? '' : 's'}`;

  return [
    `The design of ${rows} cites ${count} ${base} does not have (${places}): correct them on the trunk before the worker starts, or launch as is: its briefing lists them.`,
  ];
}
