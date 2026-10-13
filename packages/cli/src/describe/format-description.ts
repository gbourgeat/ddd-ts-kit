import type { Upstream } from '../config/index.js';
import type { StateMachineFacts } from '../docs/state-machine-facts.js';
import type {
  ConsumedEventFact,
  ContextDescription,
  ErrorFact,
  GatewayFact,
  PortFact,
  PublishedEventFact,
  RouteFact,
} from './context-description.js';

/** One context as `describe` prints it for a reader: a heading, then one block per kind of element. */
export function formatDescription(context: ContextDescription): string {
  const blocks: readonly (readonly [string, readonly string[]])[] = [
    ['aggregates', context.aggregates],
    ['domain events', context.domainEvents],
    ['permissions', context.permissions],
    ['use cases', context.useCases.map((useCase) => `${useCase.kind} ${useCase.name} (${known(useCase.permission)})`)],
    ['routes', context.routes.map(routeLine)],
    ['consumed events', context.consumedEvents.map(consumedEventLine)],
    ['published events', context.publishedEvents.map(publishedEventLine)],
    ['ports', context.ports.map(portLine)],
    ['policies', context.policies.map((policy) => `${policy.name} (on ${known(policy.permission)})`)],
    ['errors', context.errors.map(errorLine)],
    [
      'projections',
      context.projections.map(
        (projection) => `${projection.name} (${projection.projector}, applies ${projection.applies.join(', ')})`,
      ),
    ],
    ['gateways', context.gateways.map(gatewayLine)],
    ['scheduled jobs', context.jobs.map((job) => `${job.name} (${job.schedule}, sends ${job.command})`)],
    ['background jobs', context.backgroundJobs.map((job) => `${job.name} (${job.className})`)],
    ['state machines', context.stateMachines.map(stateMachineLine)],
    ['process managers', context.processes.map(({ name, className }) => `${name} (${className})`)],
  ];

  return [
    ...headingLines(context),
    ...blocks.flatMap(([label, values]) => blockLines(label, values)),
    `  contracts: ${context.contracts.openapi}, ${context.contracts.eventCatalog}`,
  ].join('\n');
}

function stateMachineLine({ aggregate, states, transitions }: StateMachineFacts): string {
  return `${aggregate} (${states.join(', ')}; ${transitions.map(({ name }) => name).join(', ')})`;
}

function errorLine({ errorClass, refusal, code, exposes }: ErrorFact): string {
  const built = refusal === '' ? errorClass : `${errorClass}.${refusal}`;

  return `${code} (${built}${exposes.length === 0 ? '' : `, exposes ${exposes.join(', ')}`})`;
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

  const responses = route.responses
    .map(({ status, schema }) => (schema === '' ? String(status) : `${status} ${schema}`))
    .join(', ');

  const behind =
    route.guards.length === 0
      ? ''
      : ` behind ${[route.group, route.guards.join(', ')].filter((part) => part !== '').join(': ')}`;

  return `${route.method} ${route.path} ${route.operationId}${behind} -> ${known(route.useCase)} (${known(route.permission)}); request: ${request === '' ? 'none' : request}; responses: ${responses}; errors: ${route.errors.join(', ')}`;
}

function consumedEventLine(event: ConsumedEventFact): string {
  return `${known(event.type)}${event.version === null ? '' : ` v${event.version}`} from ${known(event.from)}, handled by ${event.handler} (consumer ${known(event.consumer)})`;
}

function publishedEventLine(event: PublishedEventFact): string {
  return `${event.type} ${event.versions.map((version) => `v${version}`).join(', ')}${by(event.publishers)}`;
}

function portLine(port: PortFact): string {
  return `${port.name} [${port.kind === '' ? 'not bound' : port.kind}]${by(port.adapters)}`;
}

function gatewayLine(gateway: GatewayFact): string {
  return `${gateway.name} to ${gateway.upstream === '' ? 'a system outside the repository' : gateway.upstream}${by(gateway.adapters)}`;
}

/** A short list stays on its line; one line per element as soon as an element is a sentence. */
function blockLines(label: string, values: readonly string[]): string[] {
  if (values.length === 0) {
    return [`  ${label}: none`];
  }

  if (values.every((value) => !value.includes(' '))) {
    return [`  ${label}: ${values.join(', ')}`];
  }

  return [`  ${label}:`, ...values.map((value) => `    ${value}`)];
}

function by(names: readonly string[]): string {
  return names.length > 0 ? `, by ${names.join(', ')}` : '';
}

function known(value: string): string {
  return value === '' ? 'not read' : value;
}
