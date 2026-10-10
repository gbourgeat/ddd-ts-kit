import type { AuditEntry } from '@ddd-ts-kit/audit';
import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, pageRequestFrom, pageRequestParameters, pageResponse, pageSchemaOf, type Route } from '@ddd-ts-kit/http';
import { err, ok, type QueryBus } from '@ddd-ts-kit/kernel';
import { customSchema, type JsonSchema } from '@ddd-ts-kit/validation';
import { ListAuditEntriesQuery, type AuditEntriesFilter } from './list-audit-entries.query.js';

/** Newest first unless asked otherwise, by cursor: the trail only grows, an offset would shift under the reader. */
const pageLimits = { sortable: ['occurredAt', 'sequence'], maxSize: 100, kind: 'cursor' } as const;
const outcomes = ['allowed', 'denied', 'succeeded', 'failed'] as const;

type Parameters = Readonly<Record<string, unknown>>;

const query = customSchema<Parameters>((input) => (isRecord(input) ? ok(input) : err([{ path: '', code: 'invalid_type', message: 'Expected query parameters.' }])), {
  type: 'object',
  properties: {
    ...propertiesOf(pageRequestParameters(pageLimits)),
    actorId: { type: 'string', description: 'Entries about what this actor did.' },
    action: { type: 'string', description: 'A permission id, a command name or an event type.' },
    outcome: { type: 'string', enum: [...outcomes] },
    correlationId: { type: 'string', description: 'Everything one request or event caused.' },
  },
});

/** What leaves the process: identifiers and codes, as the trail holds them. `changes` and `extensions` stay inside. */
interface AuditEntryView {
  readonly id: string;
  readonly chain: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly category: string;
  readonly action: string;
  readonly outcome: string;
  readonly reason?: string;
  readonly actorId: string;
  readonly actorType: string;
  /** The support staff who acted through the actor, when the session was an impersonation. */
  readonly impersonatedBy?: string;
  readonly tenantId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly context?: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly origin: string;
  readonly previousHash: string;
  readonly hash: string;
}

const text = { type: 'string' } as const;

const entry = customSchema<AuditEntryView>((input) => (isEntryView(input) ? ok(input) : err([{ path: '', code: 'invalid_type', message: 'Expected an audit entry.' }])), {
  type: 'object',
  required: ['id', 'chain', 'sequence', 'occurredAt', 'category', 'action', 'outcome', 'actorId', 'actorType', 'correlationId', 'origin', 'previousHash', 'hash'],
  properties: {
    id: text,
    chain: text,
    sequence: { type: 'integer', minimum: 1 },
    occurredAt: { type: 'string', format: 'date-time' },
    category: text,
    action: text,
    outcome: { type: 'string', enum: [...outcomes] },
    reason: text,
    actorId: text,
    actorType: text,
    impersonatedBy: text,
    tenantId: text,
    resourceType: text,
    resourceId: text,
    context: text,
    correlationId: text,
    causationId: text,
    origin: text,
    previousHash: text,
    hash: text,
  },
});

/** The audit trail as a protected read: a use case like any other, so reading it is authorized and recorded. */
export function listAuditEntriesRoute(queries: QueryBus): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/audit/entries',
      operationId: 'listAuditEntries',
      summary: 'List the entries of the audit trail',
      tags: ['audit'],
      request: { query },
      responses: { 200: { description: 'A page of entries.', body: pageSchemaOf(entry) } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN'],
      security: ['bearer'],
    },
    async (input) => {
      const page = await queries.execute(new ListAuditEntriesQuery(actorOf(input.context.principal), pageRequestFrom(input.query, pageLimits), filterOf(input.query)));

      return { status: 200, body: pageResponse(page, toView) };
    },
  );
}

function filterOf(parameters: Parameters): AuditEntriesFilter {
  const outcome = outcomes.find((candidate) => candidate === parameters['outcome']);

  return {
    ...textOf(parameters, 'actorId'),
    ...textOf(parameters, 'action'),
    ...textOf(parameters, 'correlationId'),
    ...(outcome === undefined ? {} : { outcome }),
  };
}

function textOf<Key extends string>(parameters: Parameters, key: Key): Partial<Record<Key, string>> {
  const value = parameters[key];
  const found: Partial<Record<Key, string>> = {};

  if (typeof value === 'string' && value !== '') found[key] = value;

  return found;
}

function toView(source: AuditEntry): AuditEntryView {
  const { actor, resource } = source;

  return {
    id: source.id,
    chain: source.chain,
    sequence: source.sequence,
    occurredAt: source.occurredAt.toISOString(),
    category: source.category,
    action: source.action,
    outcome: source.outcome,
    ...(source.reason === undefined ? {} : { reason: source.reason }),
    actorId: actor.id,
    actorType: actor.type,
    ...(source.impersonatedBy === undefined ? {} : { impersonatedBy: source.impersonatedBy }),
    ...(source.tenantId === undefined ? {} : { tenantId: source.tenantId }),
    ...(resource === undefined ? {} : { resourceType: resource.type, resourceId: resource.id }),
    ...(source.context === undefined ? {} : { context: source.context }),
    correlationId: source.correlationId,
    ...(source.causationId === undefined ? {} : { causationId: source.causationId }),
    origin: source.origin,
    previousHash: source.previousHash,
    hash: source.hash,
  };
}

function propertiesOf(schema: JsonSchema): JsonSchema {
  const { properties } = schema;

  return typeof properties === 'object' && properties !== null ? { ...properties } : {};
}

function isRecord(input: unknown): input is Parameters {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isEntryView(input: unknown): input is AuditEntryView {
  return isRecord(input) && typeof input['id'] === 'string' && typeof input['hash'] === 'string' && typeof input['sequence'] === 'number';
}
