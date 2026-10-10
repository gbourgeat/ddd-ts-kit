import type { ContextFacts } from './context-facts.js';

/** The generated block of docs/context-map.md: a Mermaid diagram, then the table of contexts. */
export function contextMapLines(contexts: readonly ContextFacts[]): string[] {
  const declared = contexts.filter((context) => context.declared);

  if (declared.length === 0) {
    return ['No bounded context declared yet.'];
  }

  return ['```mermaid', ...diagram(declared), '```', '', ...table(declared)];
}

const STYLES: readonly string[] = [
  'classDef core fill:#1f6feb,stroke:#0b3d91,color:#ffffff,stroke-width:2px',
  'classDef supporting fill:#ddf4ff,stroke:#1f6feb,color:#0b3d91',
  'classDef generic fill:#f6f8fa,stroke:#8c959f,color:#24292f,stroke-dasharray: 4 3',
];

function diagram(contexts: readonly ContextFacts[]): string[] {
  const node = (name: string): string => name.replaceAll('-', '_');

  const nodes = contexts.map(
    (context) =>
      `  ${node(context.name)}["${context.name}<br/><small>${context.classification}</small>"]:::${context.classification}`,
  );

  const arrows = contexts.flatMap((context) =>
    context.upstreams.map(
      (upstream) => `  ${node(upstream.context)} -->|${upstream.relationship}| ${node(context.name)}`,
    ),
  );

  return ['flowchart LR', ...nodes, ...arrows, ...STYLES.map((style) => `  ${style}`)];
}

function table(contexts: readonly ContextFacts[]): string[] {
  const names = (values: readonly string[]): string =>
    values.length > 0 ? values.map((value) => `\`${value}\``).join(', ') : '';

  const rows = contexts.map((context) =>
    [
      `\`${context.name}\``,
      context.classification,
      context.purpose.replaceAll('|', '\\|'),
      names(context.upstreams.map((upstream) => upstream.context)),
      names(context.downstreams.map((downstream) => downstream.context)),
      names([...new Set(context.publishedEvents.map((event) => event.type))]),
      context.deployable ? 'yes' : 'no',
    ].join(' | '),
  );

  return [
    '| Context | Classification | Purpose | Upstreams | Downstreams | Published events | Deployable alone |',
    '|---|---|---|---|---|---|---|',
    ...rows.map((row) => `| ${row} |`),
  ];
}
