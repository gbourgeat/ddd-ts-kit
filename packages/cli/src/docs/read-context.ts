import { parseGlossary } from '../check/language/parse-glossary.js';
import type { Config, Upstream } from '../config/index.js';
import { toName } from '../naming/index.js';
import type { Workspace } from '../workspace/index.js';
import type { ContextFacts, PublishedEvent } from './context-facts.js';
import type { DeclaredFacts, DeclaredUseCase } from './declared-facts.js';
import { readDeclarations } from './read-declarations.js';
import { readJobs } from './read-jobs.js';
import { withoutComments } from './without-comments.js';

type RoleNames = Pick<ContextFacts, 'commands' | 'queries' | 'policies' | 'gateways' | 'integrationEventHandlers'>;

/** What the config and the files say about one context. */
export function readContext(ws: Workspace, config: Config, name: string): ContextFacts {
  const directory = `${config.contextsDir}/${name}`;
  const declared = config.contexts[name];
  const doc = ws.read(`${directory}/CONTEXT.md`) ?? '';
  const declarations = config.stack.style === 'declared' ? readDeclarations(ws, directory) : undefined;

  return {
    name,
    classification: declared?.classification ?? 'undeclared',
    declared: declared !== undefined,
    onDisk: ws.directories(config.contextsDir).includes(name),
    purpose: firstSentence(sectionOf(doc, '## Purpose')),
    glossaryTerms: parseGlossary(doc).terms,
    upstreams: declared?.upstreams ?? [],
    downstreams: downstreamsOf(config, name),
    ...treeFacts(ws, directory, name),
    ...(declarations === undefined ? namesByConvention(ws, directory) : namesByDeclaration(declarations)),
    deployable: declared?.deployable === true,
    ...(declarations === undefined ? {} : { declarations }),
  };
}

type TreeFacts = Pick<
  ContextFacts,
  'aggregates' | 'domainEvents' | 'publishedEvents' | 'builders' | 'permissions' | 'jobs'
>;

/** What the folders of the context hold, whatever the style of the project. */
function treeFacts(ws: Workspace, directory: string, name: string): TreeFacts {
  return {
    aggregates: namesBySuffix(ws, `${directory}/domain/aggregates`, '.aggregate.ts'),
    domainEvents: namesBySuffix(ws, `${directory}/domain/events`, '.event.ts'),
    publishedEvents: publishedEventsOf(ws, `${directory}/published-language`),
    builders: namesBySuffix(ws, `${directory}/test/builders`, '.builder.ts'),
    permissions: permissionsOf(ws.read(`${directory}/application/authorization/${name}.permissions.ts`) ?? ''),
    jobs: readJobs(ws, directory, name),
  };
}

/** The explicit style names nothing in its classes: the folders and the file names are what can be read. */
function namesByConvention(ws: Workspace, directory: string): RoleNames {
  return {
    commands: ws.directories(`${directory}/application/commands`).map((folder) => toName(folder).pascal),
    queries: ws.directories(`${directory}/application/queries`).map((folder) => toName(folder).pascal),
    policies: namesBySuffix(ws, `${directory}/application/authorization`, '.policy.ts'),
    gateways: namesBySuffix(ws, `${directory}/application/ports`, '-gateway.port.ts'),
    integrationEventHandlers: namesBySuffix(
      ws,
      `${directory}/application/integration/handlers`,
      '.integration-handler.ts',
    ),
  };
}

function namesByDeclaration(declarations: DeclaredFacts): RoleNames {
  const useCases = (kind: DeclaredUseCase['kind']): string[] =>
    declarations.useCases.filter((useCase) => useCase.kind === kind).map((useCase) => useCase.name);

  return {
    commands: useCases('command'),
    queries: useCases('query'),
    policies: declarations.policies.map((policy) => policy.name),
    gateways: declarations.gateways.map((gateway) => gateway.name),
    integrationEventHandlers: declarations.integrationEventHandlers.map((handler) => handler.name),
  };
}

function permissionsOf(source: string): string[] {
  return [...source.matchAll(/^\s*'([a-z0-9.-]+)':\s*\{/gm)].map((match) => match[1] ?? '');
}

function sectionOf(doc: string, heading: string): string {
  const lines = doc.split('\n');
  const start = lines.findIndex((line) => line.trim().toLowerCase() === heading.toLowerCase());

  if (start === -1) {
    return '';
  }

  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));

  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim();
}

/** The purpose shown in the context map; empty while the section still holds its placeholder. */
function firstSentence(section: string): string {
  const text = withoutComments(section).replace(/\s+/g, ' ').trim();

  if (text === '' || text.includes('TODO(domain)')) {
    return '';
  }

  return /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
}

function downstreamsOf(config: Config, name: string): Upstream[] {
  return Object.entries(config.contexts).flatMap(([other, context]) =>
    context.upstreams
      .filter((upstream) => upstream.context === name)
      .map((upstream) => ({ context: other, relationship: upstream.relationship })),
  );
}

function namesBySuffix(ws: Workspace, directory: string, suffix: string): string[] {
  return ws
    .list(directory)
    .filter((file) => file.endsWith(suffix))
    .map((file) => toName(file.slice(0, -suffix.length)).pascal);
}

const DECLARED_EVENT = /\btype:\s*'([a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+)',\s*version:\s*(\d+)/g;

function publishedEventsOf(ws: Workspace, directory: string): PublishedEvent[] {
  const events = ws.list(directory).flatMap((file) => {
    const content = (ws.read(`${directory}/${file}`) ?? '').replace(/\s+/g, ' ');

    return [...content.matchAll(DECLARED_EVENT)].map((match) => ({ type: match[1] ?? '', version: Number(match[2]) }));
  });

  return events.sort((left, right) => left.type.localeCompare(right.type) || left.version - right.version);
}
