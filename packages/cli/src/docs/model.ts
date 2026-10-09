import path from 'node:path';
import { parseGlossary } from '../check/glossary.js';
import type { Config, Upstream } from '../config.js';
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
    commands: ws.directories(`${directory}/application/commands`).map((folder) => toName(folder).pascal),
    queries: ws.directories(`${directory}/application/queries`).map((folder) => toName(folder).pascal),
    domainEvents: namesBySuffix(ws, `${directory}/domain/events`, '.event.ts'),
    publishedEvents: publishedEventsOf(ws, `${directory}/published-language`),
    builders: namesBySuffix(ws, `${directory}/test/builders`, '.builder.ts'),
  };
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
