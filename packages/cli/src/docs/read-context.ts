import { parseGlossary } from '../check/language/parse-glossary.js';
import type { Config, Upstream } from '../config/index.js';
import { roleDirectoriesOf, roleFilesOf } from '../model-modules/index.js';
import { toName } from '../naming/index.js';
import type { Workspace } from '../workspace/index.js';
import type { ContextFacts, PublishedEvent } from './context-facts.js';
import type { DeclaredFacts, DeclaredUseCase } from './declared-facts.js';
import { readDeclarations } from './read-declarations.js';
import { readBackgroundJobs } from './read-background-jobs.js';
import { readJobs } from './read-jobs.js';
import { readProcesses } from './read-processes.js';
import { readStateMachines } from './read-state-machines.js';
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
  | 'aggregates'
  | 'eventSourced'
  | 'domainEvents'
  | 'publishedEvents'
  | 'builders'
  | 'worlds'
  | 'permissions'
  | 'jobs'
  | 'backgroundJobs'
  | 'stateMachines'
  | 'processes'
>;

/** What the folders of the context hold, whatever the style of the project. */
function treeFacts(ws: Workspace, directory: string, name: string): TreeFacts {
  return {
    aggregates: namesBySuffix(ws, directory, { folder: 'domain/aggregates', suffix: '.aggregate.ts' }),
    eventSourced: eventSourcedOf(ws, directory),
    domainEvents: namesBySuffix(ws, directory, { folder: 'domain/events', suffix: '.event.ts' }),
    publishedEvents: publishedEventsOf(ws, `${directory}/published-language`),
    builders: namesBySuffix(ws, directory, { folder: 'test/builders', suffix: '.builder.ts' }),
    worlds: namesBySuffix(ws, directory, { folder: 'test/worlds', suffix: '.world.ts' }),
    permissions: permissionsOf(ws.read(`${directory}/application/authorization/${name}.permissions.ts`) ?? ''),
    jobs: readJobs(ws, directory, name),
    backgroundJobs: readBackgroundJobs(ws, directory),
    stateMachines: readStateMachines(ws, directory),
    processes: readProcesses(ws, directory),
  };
}

/** The explicit style names nothing in its classes: the folders and the file names are what can be read. */
function namesByConvention(ws: Workspace, directory: string): RoleNames {
  return {
    commands: roleDirectoriesOf(ws, directory, 'application/commands').map((folder) => toName(folder.name).pascal),
    queries: roleDirectoriesOf(ws, directory, 'application/queries').map((folder) => toName(folder.name).pascal),
    policies: namesBySuffix(ws, directory, { folder: 'application/authorization', suffix: '.policy.ts' }),
    gateways: namesBySuffix(ws, directory, { folder: 'application/ports', suffix: '-gateway.port.ts' }),
    integrationEventHandlers: namesBySuffix(ws, directory, {
      folder: 'application/integration/handlers',
      suffix: '.integration-handler.ts',
    }),
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

/** The aggregates whose class extends `EventSourcedAggregate`, read from their files. */
function eventSourcedOf(ws: Workspace, directory: string): string[] {
  return roleFilesOf(ws, directory, 'domain/aggregates')
    .filter(({ name, path }) => name.endsWith(AGGREGATE) && EVENT_SOURCED.test(ws.read(path) ?? ''))
    .map(({ name }) => toName(name.slice(0, -AGGREGATE.length)).pascal);
}

const AGGREGATE = '.aggregate.ts';
const EVENT_SOURCED = /\bextends\s+EventSourcedAggregate\b/;

/** The files of one role, by the folder of the role and the suffix of their names. */
interface RoleSuffix {
  readonly folder: string;
  readonly suffix: string;
}

/** The names of the files of a role folder, of the context and its modules, by their suffix. */
function namesBySuffix(ws: Workspace, directory: string, { folder, suffix }: RoleSuffix): string[] {
  return roleFilesOf(ws, directory, folder)
    .filter(({ name }) => name.endsWith(suffix))
    .map(({ name }) => toName(name.slice(0, -suffix.length)).pascal);
}

const DECLARED_EVENT = /\btype:\s*'([a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+)',\s*version:\s*(\d+)/g;

function publishedEventsOf(ws: Workspace, directory: string): PublishedEvent[] {
  const events = ws.list(directory).flatMap((file) => {
    const content = (ws.read(`${directory}/${file}`) ?? '').replace(/\s+/g, ' ');

    return [...content.matchAll(DECLARED_EVENT)].map((match) => ({ type: match[1] ?? '', version: Number(match[2]) }));
  });

  return events.sort((left, right) => left.type.localeCompare(right.type) || left.version - right.version);
}
