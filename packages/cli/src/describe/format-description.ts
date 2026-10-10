import type { Upstream } from '../config/index.js';
import type { ContextDescription, RouteFact } from './context-description.js';

/** One context as `describe` prints it for a reader: a heading, then one block per kind of element. */
export function formatDescription(context: ContextDescription): string {
  const blocks: readonly (readonly [string, readonly string[]])[] = [
    ['aggregates', context.aggregates],
    ['domain events', context.domainEvents],
    ['permissions', context.permissions],
    ['use cases', context.useCases.map((useCase) => `${useCase.kind} ${useCase.name} (${known(useCase.permission)})`)],
    ['routes', context.routes.map(routeLine)],
    ['consumed events', context.consumedEvents.map((event) => `${known(event.type)}${event.version === null ? '' : ` v${event.version}`} from ${known(event.from)}, handled by ${event.handler} (consumer ${known(event.consumer)})`)],
    ['published events', context.publishedEvents.map((event) => `${event.type} ${event.versions.map((version) => `v${version}`).join(', ')}${by(event.publishers)}`)],
    ['ports', context.ports.map((port) => `${port.name} [${port.kind === '' ? 'not bound' : port.kind}]${by(port.adapters)}`)],
    ['policies', context.policies.map((policy) => `${policy.name} (on ${known(policy.permission)})`)],
    ['gateways', context.gateways.map((gateway) => `${gateway.name} to ${gateway.upstream === '' ? 'a system outside the repository' : gateway.upstream}${by(gateway.adapters)}`)],
    ['scheduled jobs', context.jobs.map((job) => `${job.name} (${job.schedule}, sends ${job.command})`)],
  ];

  return [...headingLines(context), ...blocks.flatMap(([label, values]) => blockLines(label, values)), `  contracts: ${context.contracts.openapi}, ${context.contracts.eventCatalog}`].join('\n');
}

function headingLines(context: ContextDescription): string[] {
  return [
    `${context.name} [${context.classification}]${context.deployable ? ' (deployable alone)' : ''}`,
    `  purpose: ${context.purpose === '' ? 'not written' : context.purpose}`,
    `  language: ${context.doc} (${context.glossary.length} term${context.glossary.length === 1 ? '' : 's'})`,
    `  upstreams: ${relations(context.upstreams)}`,
    `  downstreams: ${relations(context.downstreams)}`,
  ];
}

function relations(contexts: readonly Upstream[]): string {
  return contexts.length > 0 ? contexts.map((other) => `${other.context} (${other.relationship})`).join(', ') : 'none';
}

function routeLine(route: RouteFact): string {
  const request = route.request.map(({ part, schema }) => (schema === part ? part : `${part} ${schema}`)).join(', ');
  const responses = route.responses.map(({ status, schema }) => (schema === '' ? String(status) : `${status} ${schema}`)).join(', ');

  return `${route.method} ${route.path} ${route.operationId} -> ${known(route.useCase)} (${known(route.permission)}); request: ${request === '' ? 'none' : request}; responses: ${responses}; errors: ${route.errors.join(', ')}`;
}

/** A short list stays on its line; one line per element as soon as an element is a sentence. */
function blockLines(label: string, values: readonly string[]): string[] {
  if (values.length === 0) return [`  ${label}: none`];
  if (values.every((value) => !value.includes(' '))) return [`  ${label}: ${values.join(', ')}`];

  return [`  ${label}:`, ...values.map((value) => `    ${value}`)];
}

function by(names: readonly string[]): string {
  return names.length > 0 ? `, by ${names.join(', ')}` : '';
}

function known(value: string): string {
  return value === '' ? 'not read' : value;
}
