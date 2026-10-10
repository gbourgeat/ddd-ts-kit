import { readConfig, type Stack } from '../config.js';
import { e2eSpecs, readContexts, type ContextFacts, type DeclaredFacts, type DeclaredUseCase } from '../docs/model.js';
import { Workspace } from '../workspace.js';
import { Arguments, type Command } from './args.js';

export const listCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const map = mapProject(args.projectRoot);
  io.out(args.json ? JSON.stringify(map, null, 2) : formatProjectMap(map));
  return 0;
};

interface ContextSummary extends Omit<ContextFacts, 'publishedEvents' | 'glossaryTerms' | 'purpose' | 'downstreams'> {
  /** Number of terms in the glossary: 0 means the language is still to be defined. */
  readonly glossary: number;
  readonly publishedEvents: readonly string[];
}

interface ProjectMap {
  readonly stack: Stack;
  readonly contexts: readonly ContextSummary[];
  readonly e2e: readonly string[];
}

function mapProject(root: string): ProjectMap {
  const { config } = readConfig(root);
  const ws = new Workspace(root, false);
  return { stack: config.stack, contexts: readContexts(ws, config).map(summarize), e2e: e2eSpecs(ws) };
}

function summarize(facts: ContextFacts): ContextSummary {
  const { publishedEvents, glossaryTerms, purpose: _purpose, downstreams: _downstreams, ...rest } = facts;
  return { ...rest, glossary: glossaryTerms.length, publishedEvents: publishedEvents.map((event) => `${event.type}@v${event.version}`) };
}

function formatProjectMap(map: ProjectMap): string {
  if (map.contexts.length === 0) {
    return 'No bounded context yet. Create one with `ddd-ts-kit generate context <name> --classification <core|supporting|generic>`.';
  }
  const e2e = `end-to-end specs: ${map.e2e.length > 0 ? map.e2e.join(', ') : 'none'}`;
  return [...map.contexts.map(formatContext), e2e].join('\n\n');
}

function formatContext(context: ContextSummary): string {
  const list = (label: string, values: readonly string[]): string => `  ${label}: ${values.length > 0 ? values.join(', ') : 'none'}`;
  const lists = context.declarations === undefined ? context : declaredLists(context.declarations);
  return [
    heading(context),
    `  glossary: ${context.glossary === 0 ? 'empty (define the ubiquitous language first)' : `${context.glossary} term${context.glossary === 1 ? '' : 's'}`}`,
    list('upstreams', context.upstreams.map((upstream) => `${upstream.context} (${upstream.relationship})`)),
    list('aggregates', context.aggregates),
    list('commands', lists.commands),
    list('queries', lists.queries),
    list('domain events', context.domainEvents),
    list('published events', context.publishedEvents),
    list('integration event handlers', lists.integrationEventHandlers),
    list('builders', context.builders),
    list('permissions', context.permissions),
    list('policies', lists.policies),
    list('gateways', lists.gateways),
    ...('adapters' in lists ? [list('adapters', lists.adapters)] : []),
    `  deployable alone: ${context.deployable ? 'yes' : 'no'}`,
  ].join('\n');
}

function heading(context: ContextSummary): string {
  const flags = [...(context.declared ? [] : ['missing from the config']), ...(context.onDisk ? [] : ['missing on disk'])];
  return `${context.name} [${context.classification}]${flags.length > 0 ? ` (${flags.join(', ')})` : ''}`;
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
    declarations.useCases.filter((useCase) => useCase.kind === kind).map(({ name, requires }) => `${name} (${requires === 'public' ? 'public' : `requires ${requires}`})`);
  return {
    commands: useCases('command'),
    queries: useCases('query'),
    integrationEventHandlers: declarations.integrationEventHandlers.map(({ name, consumer, event }) => `${name} (consumer ${consumer === '' ? 'not written' : consumer}, on ${event})`),
    policies: declarations.policies.map(({ name, permission }) => `${name} (on ${permission})`),
    gateways: declarations.gateways.map(({ name, token }) => `${name} (${token})`),
    adapters: declarations.adapters.map(({ name, token }) => `${name} (${token})`),
  };
}
