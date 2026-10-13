import { contextAlias, specifierSuffix } from '../../alias/index.js';
import type { EventNames } from '../event-names.js';
import type { Scope } from '../scope.js';

const EVENT_SOURCED = /\bextends\s+EventSourcedAggregate\b/;

/**
 * A new event of an event-sourced aggregate joins its union of events, gets its entry in
 * `appliers()` and an empty apply method, and an entry in the codec of the stored events. What
 * cannot be placed (a file reshaped by hand) is said, with the lines to write.
 */
export function extendEventSourcedAggregate(scope: Scope, names: EventNames): void {
  const aggregateFile = `${scope.dir}/domain/aggregates/${names.aggregate.kebab}.aggregate.ts`;
  const aggregate = scope.ws.read(aggregateFile);

  if (aggregate === undefined || !EVENT_SOURCED.test(aggregate)) {
    return;
  }

  const importLine = `import { ${names.event.pascal} } from '${importOf(scope, names)}';`;
  // The aggregate names the event in types only: a command that records it imports it as a value then.
  const extended = extendedAggregate(aggregate, names, importLine.replace('import {', 'import type {'));
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
  const appliers = source.indexOf('protected appliers(');
  const entriesEnd = appliers < 0 ? -1 : source.indexOf('\n    };', appliers);
  const end = source.lastIndexOf('}');

  if (!union.test(source) || entriesEnd < 0 || end < entriesEnd) {
    return undefined;
  }

  const entry = `\n      [${names.event.pascal}.eventName]: (event) => this.apply${names.fact.pascal}(event),`;
  const method = `\n  private apply${names.fact.pascal}(event: ${names.event.pascal}): void {\n    // TODO(domain): change \`this.state\` from what "${names.event.words}" says, and nothing else.\n  }\n`;
  const withEntry = `${source.slice(0, entriesEnd)}${entry}${source.slice(entriesEnd, end).trimEnd()}\n${method}}\n`;

  return withImport(withEntry.replace(union, `$1 | ${names.event.pascal};`), importLine);
}

function withStoredEvent(source: string, names: EventNames, importLine: string): string | undefined {
  const declared = source.indexOf('\n/**');
  const entriesEnd = source.lastIndexOf('\n};');

  if (declared < 0 || entriesEnd < declared) {
    return undefined;
  }

  const data = `${names.event.pascal}Data`;

  const entry = [
    `  [${names.event.pascal}.eventName]: defineStoredEvent(${names.event.pascal}, {`,
    '    version: 1,',
    `    encode: (): ${data} => ({}),`,
    `    decode: (_data, { aggregateId, occurredAt }) => new ${names.event.pascal}(aggregateId, occurredAt),`,
    '  }),',
  ].join('\n');

  const typed = `${source.slice(0, declared)}\ninterface ${data} {}\n${source.slice(declared, entriesEnd)}\n${entry}${source.slice(entriesEnd)}`;

  return withImport(typed, importLine);
}

function withImport(source: string, importLine: string): string {
  const lines = source.split('\n');
  const last = lines.reduce((found, line, index) => (line.startsWith('import ') ? index : found), -1);

  lines.splice(last + 1, 0, importLine);

  return lines.join('\n');
}
