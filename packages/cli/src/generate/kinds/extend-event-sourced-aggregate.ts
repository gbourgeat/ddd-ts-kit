import { contextAlias, specifierSuffix } from '../../alias';
import type { EventNames } from '../event-names';
import type { Scope } from '../scope';

const EVENT_SOURCED = /\bextends\s+EventSourcedAggregate\b/;

/**
 * A new event of an event-sourced aggregate joins its union of events, gets its entry in
 * `appliers()` and an empty apply method, and an entry in the codec of the stored events. Each
 * piece is added only when it is absent: an event already there (the birth event written by
 * `aggregate --birth`, or a second run) leaves both files as they are. What cannot be placed (a
 * file reshaped by hand) is said, with the lines to write.
 */
export function extendEventSourcedAggregate(scope: Scope, names: EventNames): void {
  const aggregateFile = `${scope.dir}/domain/aggregates/${names.aggregate.kebab}.aggregate.ts`;
  const aggregate = scope.ws.read(aggregateFile);

  if (aggregate === undefined || !EVENT_SOURCED.test(aggregate)) {
    return;
  }

  const importLine = `import { ${names.event.pascal} } from '${importOf(scope, names)}';`;
  // The aggregate names the event in types only: a command that records it imports it as a value then.
  const extended = extendedAggregate(aggregate, names, importLine);
  const codecFile = `${scope.dir}/infrastructure/persistence/${names.aggregate.kebab}-events.mapper.ts`;
  const codec = scope.ws.read(codecFile);
  const extendedCodec = codec === undefined ? undefined : withStoredEvent(codec, names, importLine);

  if (extended === undefined || extendedCodec === undefined) {
    scope.ws.note(
      `${names.aggregate.pascal} is event-sourced: add ${names.event.pascal} to the union of its events, \`[${names.event.pascal}.eventName]: (event) => this.apply${names.fact.pascal}(event)\` to its appliers(), the method apply${names.fact.pascal}, and its entry in ${codecFile}.`,
    );

    return;
  }

  scope.ws.update(aggregateFile, extended);
  scope.ws.update(codecFile, extendedCodec);
}

function importOf(scope: Scope, names: EventNames): string {
  const { config } = scope;

  return `${contextAlias(config, scope.context.kebab)}/domain/events/${names.event.kebab}.event${specifierSuffix(config.importExtension)}`;
}

function extendedAggregate(source: string, names: EventNames, importLine: string): string | undefined {
  const union = new RegExp(`(export type ${names.aggregate.pascal}Event =[^;]*);`);
  const members = union.exec(source)?.[1];

  if (members === undefined) {
    return undefined;
  }

  const joined = mentions(members, names.event.pascal) ? source : source.replace(union, `$1 | ${names.event.pascal};`);
  const applied = withApplier(joined, names);

  return applied === undefined
    ? undefined
    : withImport(withApplyMethod(applied, names), importLine, names.event.pascal);
}

function withApplier(source: string, names: EventNames): string | undefined {
  const key = `[${names.event.pascal}.eventName]`;

  if (source.includes(key)) {
    return source;
  }

  const appliers = source.indexOf('protected appliers(');
  const entriesEnd = appliers < 0 ? -1 : source.indexOf('\n    };', appliers);

  if (entriesEnd < 0) {
    return undefined;
  }

  const entry = `\n      ${key}: (event) => this.apply${names.fact.pascal}(event),`;

  return `${source.slice(0, entriesEnd)}${entry}${source.slice(entriesEnd)}`;
}

function withApplyMethod(source: string, names: EventNames): string {
  const declared = new RegExp(`^\\s*(?:private\\s+|protected\\s+)?apply${names.fact.pascal}\\s*\\(`, 'm');

  if (declared.test(source)) {
    return source;
  }

  const end = source.lastIndexOf('}');
  const method = `\n  private apply${names.fact.pascal}(event: ${names.event.pascal}): void {\n    // TODO(domain): change \`this.state\` from what "${names.event.words}" says, and nothing else.\n  }\n`;

  return `${source.slice(0, end).trimEnd()}\n${method}}\n`;
}

function withStoredEvent(source: string, names: EventNames, importLine: string): string | undefined {
  const declared = source.indexOf('\n/**');
  const entriesEnd = source.lastIndexOf('\n};');

  if (declared < 0 || entriesEnd < declared) {
    return undefined;
  }

  const data = `${names.event.pascal}Data`;

  const typed = new RegExp(`\\b(?:interface|type)\\s+${data}\\b`).test(source)
    ? source
    : `${source.slice(0, declared)}\ntype ${data} = Record<string, never>;\n${source.slice(declared)}`;

  if (source.includes(`[${names.event.pascal}.eventName]`)) {
    return withImport(typed, importLine, names.event.pascal);
  }

  const entry = [
    `  [${names.event.pascal}.eventName]: defineStoredEvent(${names.event.pascal}, {`,
    '    version: 1,',
    `    encode: (): ${data} => ({}),`,
    `    decode: (_data, { aggregateId, occurredAt }) => new ${names.event.pascal}(aggregateId, occurredAt),`,
    '  }),',
  ].join('\n');

  const end = typed.lastIndexOf('\n};');

  return withImport(`${typed.slice(0, end)}\n${entry}${typed.slice(end)}`, importLine, names.event.pascal);
}

function withImport(source: string, importLine: string, imported: string): string {
  if (new RegExp(`^import\\s[^;]*\\b${imported}\\b[^;]*;`, 'm').test(source)) {
    return source;
  }

  const lines = source.split('\n');
  const last = lines.reduce((found, line, index) => (line.startsWith('import ') ? index : found), -1);

  lines.splice(last + 1, 0, importLine);

  return lines.join('\n');
}

function mentions(text: string, identifier: string): boolean {
  return new RegExp(`\\b${identifier}\\b`).test(text);
}
