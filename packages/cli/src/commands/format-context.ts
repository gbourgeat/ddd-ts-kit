import type { ContextFacts } from '../docs/context-facts';
import type { DeclaredFacts, DeclaredUseCase } from '../docs/declared-facts';

export interface ContextSummary
  extends Omit<ContextFacts, 'publishedEvents' | 'glossaryTerms' | 'purpose' | 'downstreams'> {
  /** Number of terms in the glossary: 0 means the language is still to be defined. */
  readonly glossary: number;
  readonly publishedEvents: readonly string[];
}

/** One context as `list` prints it: a heading, then one line per kind of element it holds, none for a kind it lacks. */
export function formatContext(context: ContextSummary): string {
  const list = (label: string, values: readonly string[]): string[] =>
    values.length > 0 ? [`  ${label}: ${values.join(', ')}`] : [];

  const lists = context.declarations === undefined ? context : declaredLists(context.declarations);

  return [
    heading(context),
    `  glossary: ${context.glossary === 0 ? 'empty (define the ubiquitous language first)' : `${context.glossary} term${context.glossary === 1 ? '' : 's'}`}`,
    ...list('upstreams', upstreamsOf(context)),
    ...list(
      'aggregates',
      context.aggregates.map((name) => (context.eventSourced.includes(name) ? `${name} (event-sourced)` : name)),
    ),
    ...list('commands', lists.commands),
    ...list('queries', lists.queries),
    ...list('domain events', context.domainEvents),
    ...list('published events', context.publishedEvents),
    ...list('integration event handlers', lists.integrationEventHandlers),
    ...list(
      'scheduled jobs',
      context.jobs.map((job) => `${job.name} (${job.schedule}, sends ${job.command})`),
    ),
    ...list('builders', context.builders),
    ...list('worlds', context.worlds),
    ...list('permissions', context.permissions),
    ...list('policies', lists.policies),
    ...list('gateways', lists.gateways),
    ...('adapters' in lists ? list('adapters', lists.adapters) : []),
    `  deployable alone: ${context.deployable ? 'yes' : 'no'}`,
  ].join('\n');
}

function heading(context: ContextSummary): string {
  const flags = [
    ...(context.declared ? [] : ['missing from the config']),
    ...(context.onDisk ? [] : ['missing on disk']),
  ];

  return `${context.name} [${context.classification}]${flags.length > 0 ? ` (${flags.join(', ')})` : ''}`;
}

function upstreamsOf(context: ContextSummary): string[] {
  return context.upstreams.map((upstream) => `${upstream.context} (${upstream.relationship})`);
}

interface DeclaredLists {
  readonly commands: readonly string[];
  readonly queries: readonly string[];
  readonly integrationEventHandlers: readonly string[];
  readonly policies: readonly string[];
  readonly gateways: readonly string[];
  readonly adapters: readonly string[];
}

/** The lists of a declared context, each element followed by what its declaration says. */
function declaredLists(declarations: DeclaredFacts): DeclaredLists {
  const useCases = (kind: DeclaredUseCase['kind']): string[] =>
    declarations.useCases
      .filter((useCase) => useCase.kind === kind)
      .map(({ name, requires }) => `${name} (${requires === 'public' ? 'public' : `requires ${requires}`})`);

  return {
    commands: useCases('command'),
    queries: useCases('query'),
    integrationEventHandlers: declarations.integrationEventHandlers.map(
      ({ name, consumer, event }) => `${name} (consumer ${consumer === '' ? 'not written' : consumer}, on ${event})`,
    ),
    policies: declarations.policies.map(({ name, permission }) => `${name} (on ${permission})`),
    gateways: declarations.gateways.map(({ name, token }) => `${name} (${token})`),
    adapters: declarations.adapters.map(({ name, token }) => `${name} (${token})`),
  };
}
