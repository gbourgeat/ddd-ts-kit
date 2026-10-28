import { readConfig, type Stack } from '../config';
import type { ContextFacts } from '../docs/context-facts';
import { e2eSpecs } from '../docs/e2e-specs';
import { readContext } from '../docs/read-context';
import { readContexts } from '../docs/read-contexts';
import { toName } from '../naming';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import { formatContext, type ContextSummary } from './format-context';
import { knownContext } from './known-context';
import { stdoutJson } from '../json/stdout-json';

export const listCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { context: { type: 'string' } });
  const map = mapProject(args.projectRoot, args.text('context'));

  io.out(args.json ? stdoutJson(map) : formatProjectMap(map));

  return 0;
};

interface ProjectMap {
  readonly stack: Stack;
  readonly contexts: readonly ContextSummary[];
  readonly e2e: readonly string[];
}

/** The whole project, or one context of it with the end-to-end specs that drive its use cases. */
function mapProject(root: string, only: string | undefined): ProjectMap {
  const { config } = readConfig(root);
  const ws = new Workspace(root, false);

  if (only === undefined) {
    return { stack: config.stack, contexts: readContexts(ws, config).map(summarize), e2e: e2eSpecs(ws) };
  }

  const context = summarize(readContext(ws, config, knownContext(config, only)));
  const useCases = [...context.commands, ...context.queries].map((useCase) => toName(useCase).kebab);

  return { stack: config.stack, contexts: [context], e2e: e2eSpecs(ws).filter((spec) => useCases.includes(spec)) };
}

function summarize(facts: ContextFacts): ContextSummary {
  const { publishedEvents, glossaryTerms, purpose: _purpose, downstreams: _downstreams, ...rest } = facts;

  return {
    ...rest,
    glossary: glossaryTerms.length,
    publishedEvents: publishedEvents.map((event) => `${event.type}@v${event.version}`),
  };
}

function formatProjectMap(map: ProjectMap): string {
  if (map.contexts.length === 0) {
    return 'No bounded context yet. Create one with `ddd-ts-kit generate context <name> --classification <core|supporting|generic>`.';
  }

  const e2e = `end-to-end specs: ${map.e2e.length > 0 ? map.e2e.join(', ') : 'none'}`;

  return [...map.contexts.map(formatContext), e2e].join('\n\n');
}
