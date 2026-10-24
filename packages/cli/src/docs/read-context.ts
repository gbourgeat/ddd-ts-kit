import { parseGlossary } from '../check/language/parse-glossary';
import { contextFileAt, PERMISSIONS_FILE } from '../context-files';
import type { Config, Upstream } from '../config';
import { type ContextTree, roleDirectoriesOf, roleFilesOf, treeOf } from '../model-modules';
import { toName } from '../naming';
import type { Workspace } from '../workspace';
import type { ContextFacts, PublishedEvent } from './context-facts';
import type { DeclaredFacts, DeclaredUseCase } from './declared-facts';
import { readDeclarations } from './read-declarations';
import { readBackgroundJobs } from './read-background-jobs';
import { readJobs } from './read-jobs';
import { readPersonalData } from './read-personal-data';
import { readProcesses } from './read-processes';
import { readStateMachines } from './read-state-machines';
import { withoutComments } from './without-comments';

type RoleNames = Pick<ContextFacts, 'commands' | 'queries' | 'policies' | 'gateways' | 'integrationEventHandlers'>;

/** What the config and the files say about one context. */
export function readContext(ws: Workspace, config: Config, name: string): ContextFacts {
  const tree = treeOf(config, name);
  const { directory } = tree;
  const declared = config.contexts[name];
  const doc = ws.read(`${directory}/CONTEXT.md`) ?? '';
  const declarations = config.stack.style === 'declared' ? readDeclarations(ws, tree) : undefined;

  return {
    name,
    classification: declared?.classification ?? 'undeclared',
    declared: declared !== undefined,
    onDisk: ws.directories(config.contextsDir).includes(name),
    purpose: firstSentence(sectionOf(doc, '## Purpose')),
    glossaryTerms: parseGlossary(doc).terms,
    upstreams: declared?.upstreams ?? [],
    downstreams: downstreamsOf(config, name),
    ...treeFacts(ws, tree, name),
    ...(declarations === undefined ? namesByConvention(ws, tree) : namesByDeclaration(declarations)),
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
  | 'personalData'
>;

/** What the folders of the context hold, whatever the style of the project. */
function treeFacts(ws: Workspace, tree: ContextTree, name: string): TreeFacts {
  const { directory } = tree;

  return {
    aggregates: namesBySuffix(ws, tree, { folder: 'domain/aggregates', suffix: '.aggregate.ts' }),
    eventSourced: eventSourcedOf(ws, tree),
    domainEvents: namesBySuffix(ws, tree, { folder: 'domain/events', suffix: '.event.ts' }),
    publishedEvents: publishedEventsOf(ws, `${directory}/published-language`),
    builders: namesBySuffix(ws, tree, { folder: 'test/builders', suffix: '.builder.ts' }),
    worlds: namesBySuffix(ws, tree, { folder: 'test/worlds', suffix: '.world.ts' }),
    permissions: permissionsOf(
      ws.read(
        `${directory}/${contextFileAt(PERMISSIONS_FILE, name, (relative) => ws.exists(`${directory}/${relative}`))}`,
      ) ?? '',
    ),
    jobs: readJobs(ws, tree, name),
    backgroundJobs: readBackgroundJobs(ws, tree),
    stateMachines: readStateMachines(ws, tree),
    processes: readProcesses(ws, tree),
    personalData: readPersonalData(ws, tree),
  };
}

/** The explicit style names nothing in its classes: the folders and the file names are what can be read. */
function namesByConvention(ws: Workspace, tree: ContextTree): RoleNames {
  return {
    commands: roleDirectoriesOf(ws, tree, 'application/commands').map((folder) => toName(folder.name).pascal),
    queries: roleDirectoriesOf(ws, tree, 'application/queries').map((folder) => toName(folder.name).pascal),
    policies: namesBySuffix(ws, tree, { folder: 'application/authorization', suffix: '.policy.ts' }),
    gateways: namesBySuffix(ws, tree, { folder: 'application/ports', suffix: '-gateway.port.ts' }),
    integrationEventHandlers: namesBySuffix(ws, tree, {
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
function eventSourcedOf(ws: Workspace, tree: ContextTree): string[] {
  return roleFilesOf(ws, tree, 'domain/aggregates')
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
function namesBySuffix(ws: Workspace, tree: ContextTree, { folder, suffix }: RoleSuffix): string[] {
  return roleFilesOf(ws, tree, folder)
    .filter(({ name }) => name.endsWith(suffix))
    .map(({ name }) => toName(name.slice(0, -suffix.length)).pascal);
}

const DECLARED_EVENT = /\btype:\s*'([a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+)',\s*version:\s*(\d+)/g;

function publishedEventsOf(ws: Workspace, directory: string): PublishedEvent[] {
  const events = ws.list(directory).flatMap((file) => {
    const content = (ws.read(`${directory}/${file}`) ?? '').replace(/\s+/g, ' ');

    return [...content.matchAll(DECLARED_EVENT)].map((match, position, all) => {
      const declaration = content.slice(match.index, all[position + 1]?.index);
      const personal = personalPayloadOf(declaration);

      return { type: match[1] ?? '', version: Number(match[2]), ...(personal === undefined ? {} : { personal }) };
    });
  });

  return events.sort((left, right) => left.type.localeCompare(right.type) || left.version - right.version);
}

/** The `personal: { subject, fields }` option of one declared event, as written. */
function personalPayloadOf(declaration: string): PublishedEvent['personal'] {
  const option = /\bpersonal:\s*\{([^}]*)\}/.exec(declaration)?.[1];
  const subject = option === undefined ? undefined : /\bsubject:\s*['"]([^'"]+)['"]/.exec(option)?.[1];

  if (option === undefined || subject === undefined) {
    return undefined;
  }

  const fields = /\bfields:\s*\[([^\]]*)\]/.exec(option)?.[1] ?? '';

  return { subject, fields: [...fields.matchAll(/['"]([^'"]+)['"]/g)].map((field) => field[1] ?? '') };
}
