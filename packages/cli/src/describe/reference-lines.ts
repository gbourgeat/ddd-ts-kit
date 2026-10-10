import path from 'node:path';
import type { Upstream } from '../config/index.js';
import type { ContextDescription, RouteFact } from './context-description.js';

interface Table {
  readonly title: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** The generated reference of a CONTEXT.md: one line of dependencies, then one table per kind of element the context has. */
export function referenceLines(context: ContextDescription): string[] {
  const link = (file: string): string => path.posix.relative(path.posix.dirname(context.doc), file);
  const { openapi, eventCatalog } = context.contracts;

  return [
    `Generated from the code by \`ddd-ts-kit docs\`; the same facts as data: \`ddd-ts-kit describe ${context.name} --json\`. The fields of each schema are in the generated contracts: [OpenAPI](${link(openapi)}), [event catalog](${link(eventCatalog)}).`,
    '',
    `**Dependencies**: upstreams: ${relations(context.upstreams)}; downstreams: ${relations(context.downstreams)}.`,
    ...tablesOf(context).flatMap(tableLines),
  ];
}

function relations(contexts: readonly Upstream[]): string {
  return contexts.length > 0
    ? contexts.map((other) => `\`${other.context}\` (${other.relationship})`).join(', ')
    : 'none';
}

function tablesOf(context: ContextDescription): Table[] {
  return [
    {
      title: 'Use cases',
      columns: ['Use case', 'Kind', 'Permission'],
      rows: context.useCases.map((useCase) => [code(useCase.name), useCase.kind, code(useCase.permission)]),
    },
    {
      title: 'Routes',
      columns: ['Method', 'Path', 'Operation', 'Use case', 'Permission', 'Request', 'Responses', 'Errors'],
      rows: context.routes.map(routeRow),
    },
    ...eventTables(context),
    ...adapterTables(context),
  ];
}

function eventTables(context: ContextDescription): Table[] {
  return [
    {
      title: 'Consumed events',
      columns: ['Event', 'Version', 'From', 'Handler', 'Consumer'],
      rows: context.consumedEvents.map((event) => [
        code(event.type),
        event.version === null ? 'not declared' : String(event.version),
        code(event.from),
        code(event.handler),
        code(event.consumer),
      ]),
    },
    {
      title: 'Publishers',
      columns: ['Event', 'Versions', 'Publisher'],
      rows: context.publishedEvents.map((event) => [
        code(event.type),
        event.versions.join(', '),
        codes(event.publishers),
      ]),
    },
  ];
}

/** The tables of what the context binds: its ports, its policies and its gateways. */
function adapterTables(context: ContextDescription): Table[] {
  return [
    {
      title: 'Ports',
      columns: ['Port', 'Kind', 'Adapters'],
      rows: context.ports.map((port) => [
        code(port.name),
        port.kind === '' ? 'not bound' : port.kind,
        codes(port.adapters),
      ]),
    },
    {
      title: 'Policies',
      columns: ['Policy', 'Permission'],
      rows: context.policies.map((policy) => [code(policy.name), code(policy.permission)]),
    },
    {
      title: 'Gateways',
      columns: ['Gateway', 'Upstream', 'Adapters'],
      rows: context.gateways.map((gateway) => [
        code(gateway.name),
        gateway.upstream === '' ? 'outside the repository' : code(gateway.upstream),
        codes(gateway.adapters),
      ]),
    },
  ];
}

function routeRow(route: RouteFact): string[] {
  const request = route.request
    .map(({ part, schema }) => (schema === part ? part : `${part}: \`${schema}\``))
    .join(', ');

  const responses = route.responses
    .map(({ status, schema }) => (schema === '' ? String(status) : `${status}: \`${schema}\``))
    .join(', ');

  return [
    route.method,
    code(route.path),
    code(route.operationId),
    code(route.useCase),
    code(route.permission),
    request,
    responses,
    codes(route.errors),
  ];
}

/** A table is written only when it has rows: an absent table says the context has none. */
function tableLines({ title, columns, rows }: Table): string[] {
  if (rows.length === 0) {
    return [];
  }

  return [
    '',
    `### ${title}`,
    '',
    `| ${columns.join(' | ')} |`,
    `|${columns.map(() => '---').join('|')}|`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ];
}

function code(value: string): string {
  return value === '' ? 'not read' : `\`${value.replaceAll('|', '\\|')}\``;
}

function codes(values: readonly string[]): string {
  return values.map(code).join(', ');
}
