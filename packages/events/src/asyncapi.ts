import type { JsonSchema } from '@ddd-ts-kit/validation';
import type { AnyIntegrationEventDefinition } from './definition.js';
import type { EventRegistry } from './registry.js';
import {
  asSchema,
  compareText,
  rewriteLocalRefs,
  sortKeys,
  splitDefinitions,
} from './internal/json-schema.js';

export interface AsyncApiInfo {
  readonly title: string;
  readonly version: string;
  readonly description?: string;
}

export interface AsyncApiServer {
  readonly host: string;
  /** `amqp`, `kafka`, `nats`, `sqs`... */
  readonly protocol: string;
  readonly description?: string;
}

export interface GenerateAsyncApiOptions {
  readonly info: AsyncApiInfo;
  readonly registry: EventRegistry;
  readonly servers?: Readonly<Record<string, AsyncApiServer>>;
}

export interface AsyncApiDocument {
  readonly asyncapi: '3.0.0';
  readonly info: AsyncApiInfo;
  readonly servers?: Record<string, AsyncApiServer>;
  readonly channels: Record<string, JsonSchema>;
  readonly operations: Record<string, JsonSchema>;
  readonly components: {
    readonly messages: Record<string, JsonSchema>;
    readonly schemas?: Record<string, JsonSchema>;
  };
}

/**
 * One channel per event type (its address is the type), one message per version, one `send`
 * operation per channel. The output depends only on the registry content, never on the
 * registration order, so the document can be committed and diffed in CI.
 */
export function generateAsyncApi(options: GenerateAsyncApiOptions): AsyncApiDocument {
  const channels: Record<string, JsonSchema> = {};
  const operations: Record<string, JsonSchema> = {};
  const messages: Record<string, JsonSchema> = {};
  const schemas: Record<string, JsonSchema> = {};

  for (const [type, versions] of groupByType(options.registry.all())) {
    const channelMessages = collectMessages(versions, { messages, schemas });
    channels[type] = channel(type, versions.at(-1)?.description, channelMessages);
    operations[`send.${type}`] = sendOperation(type, channelMessages);
  }

  const { info, servers } = options;
  return {
    asyncapi: '3.0.0',
    info: {
      title: info.title,
      version: info.version,
      ...(info.description === undefined ? {} : { description: info.description }),
    },
    ...(servers === undefined ? {} : { servers: sortKeys(servers) }),
    channels,
    operations,
    components: {
      messages,
      ...(Object.keys(schemas).length === 0 ? {} : { schemas: sortKeys(schemas) }),
    },
  };
}

/** The exact bytes to commit: two-space JSON and a trailing newline. */
export function stringifyAsyncApi(document: AsyncApiDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** Compares the generated document with the committed one, ignoring line-ending style. */
export function checkAsyncApiDrift(
  document: AsyncApiDocument,
  existingFileContent: string,
): { drift: boolean } {
  return { drift: stringifyAsyncApi(document) !== existingFileContent.replaceAll('\r\n', '\n') };
}

// `all()` is sorted by type then version, so the groups and their content come out sorted.
function groupByType(
  definitions: readonly AnyIntegrationEventDefinition[],
): Map<string, AnyIntegrationEventDefinition[]> {
  const groups = new Map<string, AnyIntegrationEventDefinition[]>();
  for (const definition of definitions) {
    groups.set(definition.type, [...(groups.get(definition.type) ?? []), definition]);
  }
  return groups;
}

interface Components {
  readonly messages: Record<string, JsonSchema>;
  readonly schemas: Record<string, JsonSchema>;
}

/** Adds every version to the components and returns the references the channel lists. */
function collectMessages(
  versions: readonly AnyIntegrationEventDefinition[],
  components: Components,
): Record<string, JsonSchema> {
  const channelMessages: Record<string, JsonSchema> = {};
  for (const definition of versions) {
    const messageId = `${definition.type}.v${definition.version}`;
    components.messages[messageId] = message(definition, messageId, components.schemas);
    channelMessages[`v${definition.version}`] = { $ref: `#/components/messages/${messageId}` };
  }
  return channelMessages;
}

function channel(
  type: string,
  description: string | undefined,
  channelMessages: Record<string, JsonSchema>,
): JsonSchema {
  return {
    address: type,
    ...(description === undefined ? {} : { description }),
    messages: channelMessages,
  };
}

function sendOperation(type: string, channelMessages: Record<string, JsonSchema>): JsonSchema {
  return {
    action: 'send',
    channel: { $ref: `#/channels/${type}` },
    messages: Object.keys(channelMessages).map((key) => ({
      $ref: `#/channels/${type}/messages/${key}`,
    })),
  };
}

function message(
  definition: AnyIntegrationEventDefinition,
  messageId: string,
  schemas: Record<string, JsonSchema>,
): JsonSchema {
  return {
    name: definition.type,
    title: `${definition.type} v${definition.version}`,
    ...(definition.description === undefined ? {} : { summary: definition.description }),
    ...(definition.deprecated ? { deprecated: true } : {}),
    contentType: 'application/json',
    tags: [{ name: definition.producer }],
    payload: envelope(definition, payloadSchema(definition, messageId, schemas)),
  };
}

/**
 * Local definitions (`$defs`) of a payload schema are moved to `components.schemas` under the
 * message id, because a `#/$defs/...` pointer means nothing once the schema is embedded.
 */
function payloadSchema(
  definition: AnyIntegrationEventDefinition,
  messageId: string,
  schemas: Record<string, JsonSchema>,
): JsonSchema {
  const { schema, definitions } = splitDefinitions(definition.payload.toJsonSchema());
  const names = Object.keys(definitions).sort(compareText);
  const rename = (name: string): string | undefined =>
    names.includes(name) ? `#/components/schemas/${messageId}.${name}` : undefined;
  for (const name of names) {
    schemas[`${messageId}.${name}`] = asSchema(rewriteLocalRefs(definitions[name], rename));
  }
  return asSchema(rewriteLocalRefs(schema, rename));
}

function envelope(definition: AnyIntegrationEventDefinition, payload: JsonSchema): JsonSchema {
  return {
    type: 'object',
    required: ['id', 'type', 'version', 'occurredAt', 'payload'],
    properties: {
      id: { type: 'string', description: 'Unique id of the event: the idempotency key.' },
      type: { type: 'string', const: definition.type },
      version: { type: 'integer', const: definition.version },
      occurredAt: { type: 'string', format: 'date-time' },
      payload,
      traceparent: {
        type: 'string',
        description: 'W3C traceparent captured at publication.',
      },
      correlationId: { type: 'string' },
    },
  };
}
