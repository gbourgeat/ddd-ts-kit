import { readConfig, type Stack } from '../config.js';
import { e2eSpecs, readContexts, type ContextFacts } from '../docs/model.js';
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
  const flags = [...(context.declared ? [] : ['missing from the config']), ...(context.onDisk ? [] : ['missing on disk'])];
  return [
    `${context.name} [${context.classification}]${flags.length > 0 ? ` (${flags.join(', ')})` : ''}`,
    `  glossary: ${context.glossary === 0 ? 'empty (define the ubiquitous language first)' : `${context.glossary} term${context.glossary === 1 ? '' : 's'}`}`,
    list('upstreams', context.upstreams.map((upstream) => `${upstream.context} (${upstream.relationship})`)),
    list('aggregates', context.aggregates),
    list('commands', context.commands),
    list('queries', context.queries),
    list('domain events', context.domainEvents),
    list('published events', context.publishedEvents),
    list('builders', context.builders),
  ].join('\n');
}
