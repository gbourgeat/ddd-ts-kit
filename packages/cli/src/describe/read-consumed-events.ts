import { toName } from '../naming/index.js';
import type { ConsumedEventFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';
import { readEventDefinitions, type EventDefinition } from './read-event-definitions.js';

const FOLDER = 'application/integration/handlers';
const SUFFIX = '.integration-handler.ts';

/** The integration events a context reacts to, one per handler file, with what its declaration or its subscription says. */
export function readConsumedEvents(sources: ContextSources): ConsumedEventFact[] {
  const { ws, directory } = sources;

  return ws
    .list(`${directory}/${FOLDER}`)
    .filter((file) => file.endsWith(SUFFIX))
    .map((file) => consumedBy(sources, file))
    .sort((left, right) => left.type.localeCompare(right.type) || left.handler.localeCompare(right.handler));
}

function consumedBy(sources: ContextSources, file: string): ConsumedEventFact {
  const path = `${sources.directory}/${FOLDER}/${file}`;
  const source = sources.ws.read(path) ?? '';
  const handler = /\bexport class (\w+)/.exec(source)?.[1] ?? `${toName(file.slice(0, -SUFFIX.length)).pascal}IntegrationHandler`;
  const text = `${source}\n${wiringOf(sources.module, handler)}`;

  return { ...eventOf(sources, source, text), handler, consumer: /\bconsumer:\s*'([^']+)'/.exec(text)?.[1] ?? '', file: path };
}

/** The event a handler reacts to: the declaration it is given, or the type it names itself when the event has none here. */
function eventOf(sources: ContextSources, source: string, text: string): Pick<ConsumedEventFact, 'type' | 'version' | 'from'> {
  const given = givenDefinition(sources, text);

  if (given !== undefined) return { type: given.definition.type, version: given.definition.version, from: given.context };

  const type = /\bstatic readonly eventType = '([^']+)'/.exec(source)?.[1] ?? '';

  return { type, version: null, from: type.split('.')[0] ?? '' };
}

/** The statements of a module file that name the handler: the generators set each one apart by a blank line. */
function wiringOf(module: string, handler: string): string {
  const instance = `${handler.charAt(0).toLowerCase()}${handler.slice(1)}`;
  const named = new RegExp(String.raw`\b(?:${handler}|${instance})\b`);

  return module
    .split(/\n\s*\n/)
    .filter((statement) => named.test(statement))
    .join('\n');
}

interface GivenDefinition {
  readonly context: string;
  readonly definition: EventDefinition;
}

/** The declaration a handler is given (`@IntegrationEventHandler(definition`, `on(definition`), found in the published language it is imported from. */
function givenDefinition({ ws, config }: ContextSources, text: string): GivenDefinition | undefined {
  const local = /(?:@IntegrationEventHandler|\bon)\(\s*(\w+)\s*,/.exec(text)?.[1];

  for (const [, names = '', from = ''] of text.matchAll(/\bimport \{([^}]*)\} from '([^']*\/published-language\/[^']*)'/g)) {
    const context = /([a-z0-9-]+)\/published-language\//.exec(from)?.[1] ?? '';
    const original = originalName(names, local);
    const definition = readEventDefinitions(ws, `${config.contextsDir}/${context}`).find((candidate) => candidate.name === original);

    if (definition !== undefined) return { context, definition };
  }

  return undefined;
}

/** The exported name behind a local one in the names of an import clause: `invoiceIssuedV2 as billingInvoiceIssuedDefinition`. */
function originalName(names: string, local: string | undefined): string | undefined {
  return names
    .split(',')
    .map((name) => name.trim().split(/\s+as\s+/))
    .find(([original, alias]) => (alias ?? original) === local)?.[0];
}
