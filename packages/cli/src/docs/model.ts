import path from 'node:path';
import { argumentsOf, declaredAs, literalIn, optionOf, type Decoration } from '../check/declarations.js';
import { parseGlossary } from '../check/glossary.js';
import { scan, type Scan } from '../check/scanner.js';
import type { Config, Upstream } from '../config.js';
import { declaredRoleOf } from '../declared/roles.js';
import { toName } from '../naming.js';
import type { Workspace } from '../workspace.js';

/** What the documentation and `list` say about one bounded context, read from the config and the files. */
export interface ContextFacts {
  readonly name: string;
  readonly classification: string;
  readonly declared: boolean;
  readonly onDisk: boolean;
  readonly purpose: string;
  readonly glossaryTerms: readonly string[];
  readonly upstreams: readonly Upstream[];
  readonly downstreams: readonly Upstream[];
  readonly aggregates: readonly string[];
  readonly commands: readonly string[];
  readonly queries: readonly string[];
  readonly domainEvents: readonly string[];
  readonly publishedEvents: readonly PublishedEvent[];
  readonly builders: readonly string[];
  /** Permission names declared in `application/authorization/<context>.permissions.ts`. */
  readonly permissions: readonly string[];
  readonly policies: readonly string[];
  readonly gateways: readonly string[];
  /** The classes that react to an integration event, `application/integration/handlers/*.integration-handler.ts`. */
  readonly integrationEventHandlers: readonly string[];
  /** The context has its own entry point under `apps/`. */
  readonly deployable: boolean;
  /** What the decorators of the role files say, in a declared-style project. */
  readonly declarations?: DeclaredFacts;
}

/** A context read through its declarations: who may send each use case, what each handler consumes, what each adapter binds. */
export interface DeclaredFacts {
  readonly useCases: readonly DeclaredUseCase[];
  readonly integrationEventHandlers: readonly DeclaredIntegrationEventHandler[];
  readonly policies: readonly DeclaredPolicy[];
  readonly gateways: readonly DeclaredBinding[];
  /** Repositories and the adapters of the other ports. */
  readonly adapters: readonly DeclaredBinding[];
}

export interface DeclaredUseCase {
  readonly kind: 'command' | 'query';
  readonly name: string;
  /** The permission `@Requires` names, or `public`. */
  readonly requires: string;
}

interface DeclaredIntegrationEventHandler {
  readonly name: string;
  /** The consumer name, empty when it is not written as a literal. */
  readonly consumer: string;
  /** The event definition the handler is given. */
  readonly event: string;
}

interface DeclaredPolicy {
  readonly name: string;
  readonly permission: string;
}

interface DeclaredBinding {
  readonly name: string;
  readonly token: string;
}

interface PublishedEvent {
  readonly type: string;
  readonly version: number;
}

export function readContexts(ws: Workspace, config: Config): ContextFacts[] {
  const onDisk = ws.directories(config.contextsDir);
  const names = [...new Set([...Object.keys(config.contexts), ...onDisk])].sort();
  return names.map((name) => readContext(ws, config, name));
}

export function readContext(ws: Workspace, config: Config, name: string): ContextFacts {
  const directory = `${config.contextsDir}/${name}`;
  const declared = config.contexts[name];
  const doc = ws.read(`${directory}/CONTEXT.md`) ?? '';
  const { names, said } = readRoles(ws, config, directory);
  return {
    name,
    classification: declared?.classification ?? 'undeclared',
    declared: declared !== undefined,
    onDisk: ws.directories(config.contextsDir).includes(name),
    purpose: firstSentence(sectionOf(doc, '## Purpose')),
    glossaryTerms: parseGlossary(doc).terms,
    upstreams: declared?.upstreams ?? [],
    downstreams: downstreamsOf(config, name),
    aggregates: namesBySuffix(ws, `${directory}/domain/aggregates`, '.aggregate.ts'),
    commands: names.commands,
    queries: names.queries,
    domainEvents: namesBySuffix(ws, `${directory}/domain/events`, '.event.ts'),
    publishedEvents: publishedEventsOf(ws, `${directory}/published-language`),
    builders: namesBySuffix(ws, `${directory}/test/builders`, '.builder.ts'),
    permissions: permissionsOf(ws.read(`${directory}/application/authorization/${name}.permissions.ts`) ?? ''),
    policies: names.policies,
    gateways: names.gateways,
    integrationEventHandlers: names.integrationEventHandlers,
    deployable: declared?.deployable === true,
    ...said,
  };
}

/** The elements of a context that play a role, named as the style of the project lets them be read. */
function readRoles(ws: Workspace, config: Config, directory: string): { names: RoleNames; said: Pick<ContextFacts, 'declarations'> } {
  if (config.stack.style !== 'declared') return { names: namesByConvention(ws, directory), said: {} };
  const declarations = readDeclarations(ws, directory);
  return { names: namesByDeclaration(declarations), said: { declarations } };
}

type RoleNames = Pick<ContextFacts, 'commands' | 'queries' | 'policies' | 'gateways' | 'integrationEventHandlers'>;

/** The explicit style names nothing in its classes: the folders and the file names are what can be read. */
function namesByConvention(ws: Workspace, directory: string): RoleNames {
  return {
    commands: ws.directories(`${directory}/application/commands`).map((folder) => toName(folder).pascal),
    queries: ws.directories(`${directory}/application/queries`).map((folder) => toName(folder).pascal),
    policies: namesBySuffix(ws, `${directory}/application/authorization`, '.policy.ts'),
    gateways: namesBySuffix(ws, `${directory}/application/ports`, '-gateway.port.ts'),
    integrationEventHandlers: namesBySuffix(ws, `${directory}/application/integration/handlers`, '.integration-handler.ts'),
  };
}

function namesByDeclaration(declarations: DeclaredFacts): RoleNames {
  const useCases = (kind: DeclaredUseCase['kind']): string[] => declarations.useCases.filter((useCase) => useCase.kind === kind).map((useCase) => useCase.name);
  return {
    commands: useCases('command'),
    queries: useCases('query'),
    policies: declarations.policies.map((policy) => policy.name),
    gateways: declarations.gateways.map((gateway) => gateway.name),
    integrationEventHandlers: declarations.integrationEventHandlers.map((handler) => handler.name),
  };
}

/** One exported class of a role file, with the declaration that gives it its role. */
interface Declared {
  /** The suffix of the role file: `command`, `query`, `policy`... */
  readonly suffix: string;
  readonly className: string;
  readonly decoration: Decoration;
  readonly source: Scan;
  readonly text: string;
}

function readDeclarations(ws: Workspace, directory: string): DeclaredFacts {
  const declared = declaredClasses(ws, directory);
  const carrying = (...decorators: string[]): Declared[] => declared.filter(({ decoration }) => decorators.includes(decoration.name));
  const binding = (found: Declared): DeclaredBinding => ({ name: found.className, token: argument(found, 0) });
  return {
    useCases: carrying('Requires', 'Public').map(useCase),
    integrationEventHandlers: carrying('IntegrationEventHandler').map((found) => ({ name: found.className, consumer: option(found, 'consumer'), event: argument(found, 0) })),
    policies: carrying('Policy').map((found) => ({ name: option(found, 'name') || found.className, permission: permission(found) })),
    gateways: carrying('Gateway').map(binding),
    adapters: carrying('Repository', 'Adapter').map(binding),
  };
}

/** The classes the role files of a context export with the decorator of their role, in the order of their paths. */
function declaredClasses(ws: Workspace, directory: string): Declared[] {
  return filesBelow(ws, directory, '').flatMap((file) => {
    const role = declaredRoleOf(file);
    const text = role === undefined ? undefined : ws.read(`${directory}/${file}`);
    if (role === undefined || text === undefined) return [];
    const source = scan(text);
    return declaredAs(source, role.decorators).map(({ declared, decoration }) => ({ suffix: role.suffix, className: declared.name, decoration, source, text }));
  });
}

function filesBelow(ws: Workspace, directory: string, inside: string): string[] {
  const here = inside === '' ? directory : `${directory}/${inside}`;
  const prefix = inside === '' ? '' : `${inside}/`;
  return [...ws.list(here).map((name) => `${prefix}${name}`), ...ws.directories(here).flatMap((child) => filesBelow(ws, directory, `${prefix}${child}`))];
}

function useCase(found: Declared): DeclaredUseCase {
  return {
    kind: found.suffix === 'query' ? 'query' : 'command',
    name: found.className.replace(/(?:Command|Query)$/, ''),
    requires: found.decoration.name === 'Public' ? 'public' : permission(found),
  };
}

/** The permission a declaration names: the literal inside its first argument (`permissions['invoice.issue']`), else the argument as written. */
function permission(found: Declared): string {
  const first = argumentsOf(found.source, found.decoration)[0];
  return (first === undefined ? undefined : literalIn(found.source, first)) ?? argument(found, 0);
}

/** An argument of the declaration as it is written in the source. */
function argument({ source, decoration, text }: Declared, index: number): string {
  const found = argumentsOf(source, decoration)[index];
  return found === undefined ? '' : text.slice(found.start, found.start + found.code.length);
}

function option({ source, decoration }: Declared, key: string): string {
  return optionOf(source, decoration, key)?.literal ?? '';
}

function permissionsOf(source: string): string[] {
  return [...source.matchAll(/^\s*'([a-z0-9.-]+)':\s*\{/gm)].map((match) => match[1] ?? '');
}

function sectionOf(doc: string, heading: string): string {
  const lines = doc.split('\n');
  const start = lines.findIndex((line) => line.trim().toLowerCase() === heading.toLowerCase());
  if (start === -1) return '';
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim();
}

/** The purpose shown in the context map; empty while the section still holds its placeholder. */
function firstSentence(section: string): string {
  const text = section.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
  if (text === '' || text.includes('TODO(domain)')) return '';
  return /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
}

function downstreamsOf(config: Config, name: string): Upstream[] {
  return Object.entries(config.contexts).flatMap(([other, context]) =>
    context.upstreams.filter((upstream) => upstream.context === name).map((upstream) => ({ context: other, relationship: upstream.relationship })),
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
  return events.sort((a, b) => a.type.localeCompare(b.type) || a.version - b.version);
}

export function e2eSpecs(ws: Workspace): string[] {
  return ws.list('test/e2e').filter((file) => file.endsWith('.e2e.spec.ts')).map((file) => path.posix.basename(file, '.e2e.spec.ts'));
}
