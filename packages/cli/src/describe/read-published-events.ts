import type { PublishedEventFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';
import { readEventDefinitions, type EventDefinition } from './read-event-definitions.js';
import { roleFilesOf } from '../model-modules/index.js';

const FOLDER = 'application/integration/publishers';

/** The integration events a context publishes, by type: the versions it declares and the classes that publish them. */
export function readPublishedEvents(sources: ContextSources): PublishedEventFact[] {
  const definitions = readEventDefinitions(sources.ws, sources.directory);
  const publishers = publishersOf(sources);
  const types = [...new Set(definitions.map((definition) => definition.type))].sort();

  return types.map((type) => {
    const declared = definitions.filter((definition) => definition.type === type);

    return {
      type,
      versions: declared.map((definition) => definition.version).sort((left, right) => left - right),
      publishers: publishers
        .filter((publisher) => declared.some((definition) => mentions(publisher.source, definition)))
        .map((publisher) => publisher.name),
    };
  });
}

interface Publisher {
  readonly name: string;
  readonly source: string;
}

function publishersOf({ ws, directory }: ContextSources): Publisher[] {
  return roleFilesOf(ws, directory, FOLDER)
    .filter(({ name }) => name.endsWith('.publisher.ts'))
    .map(({ path }) => ws.read(path) ?? '')
    .map((source) => ({ name: /\bexport class (\w+)/.exec(source)?.[1] ?? '', source }))
    .filter((publisher) => publisher.name !== '')
    .sort((left, right) => left.name.localeCompare(right.name));
}

function mentions(source: string, definition: EventDefinition): boolean {
  return new RegExp(String.raw`\b${definition.name}\b`).test(source);
}
