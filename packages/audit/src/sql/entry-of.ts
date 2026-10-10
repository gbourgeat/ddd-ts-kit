import type {
  ActorType,
  AuditActor,
  AuditChange,
  AuditChanges,
  AuditEntry,
  AuditEntryExtensionValues,
  AuditOutcome,
  AuditResource,
} from '@ddd-ts-kit/kernel';
import type { SqlRow } from './sql-row.js';

/** The mapper: a row comes back as the driver gives it, and leaves as an entry or not at all. */
export function entryOf(row: SqlRow): AuditEntry {
  const resource = resourceOf(row);
  const changes = changesOf(json(row['changes']));

  return {
    id: text(row, 'id'),
    chain: text(row, 'chain'),
    sequence: Number(row['sequence']),
    occurredAt: instant(row['occurred_at']),
    category: text(row, 'category'),
    action: text(row, 'action'),
    outcome: outcomeOf(text(row, 'outcome')),
    ...optional('reason', row['reason']),
    actor: actorOf(row),
    ...optional('tenantId', row['tenant_id']),
    ...optional('impersonatedBy', row['impersonated_by']),
    ...optional('sessionId', row['session_id']),
    ...(resource === undefined ? {} : { resource }),
    ...optional('context', row['context']),
    correlationId: text(row, 'correlation_id'),
    ...optional('causationId', row['causation_id']),
    origin: text(row, 'origin'),
    ...(changes === undefined ? {} : { changes }),
    extensions: extensionsOf(json(row['extensions'])),
    previousHash: text(row, 'previous_hash'),
    hash: text(row, 'hash'),
  };
}

function text(row: SqlRow, column: string): string {
  const value = row[column];

  if (typeof value !== 'string') throw new TypeError(`Column ${column} of an audit entry is not a text`);

  return value;
}

function optional<Key extends string>(key: Key, value: unknown): { readonly [K in Key]?: string } {
  const present: { [K in Key]?: string } = {};

  if (typeof value === 'string') present[key] = value;

  return present;
}

function instant(value: unknown): Date {
  if (value instanceof Date) return value;

  if (typeof value === 'string' || typeof value === 'number') return new Date(value);

  throw new TypeError('Column occurred_at of an audit entry is not an instant');
}

/** node-postgres parses jsonb; a driver that does not hands the text over. */
function json(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

const OUTCOMES: readonly string[] = ['allowed', 'denied', 'succeeded', 'failed'] satisfies readonly AuditOutcome[];

function outcomeOf(value: string): AuditOutcome {
  if (isOutcome(value)) return value;

  throw new TypeError(`"${value}" is not an audit outcome`);
}

function isOutcome(value: string): value is AuditOutcome {
  return OUTCOMES.includes(value);
}

const ACTOR_TYPES: readonly string[] = ['user', 'service', 'system', 'anonymous', 'unknown'] satisfies readonly AuditActor['type'][];

function actorOf(row: SqlRow): AuditActor {
  const type = text(row, 'actor_type');

  if (!isActorType(type)) throw new TypeError(`"${type}" is not an actor type`);

  return { id: text(row, 'actor_id'), type, ...optional('tenantId', row['actor_tenant_id']) };
}

function isActorType(value: string): value is ActorType | 'unknown' {
  return ACTOR_TYPES.includes(value);
}

function resourceOf(row: SqlRow): AuditResource | undefined {
  const type = row['resource_type'];
  const id = row['resource_id'];

  return typeof type === 'string' && typeof id === 'string' ? { type, id } : undefined;
}

function changesOf(value: unknown): AuditChanges | undefined {
  if (typeof value !== 'object' || value === null) return undefined;

  const changes: Record<string, AuditChange> = {};

  for (const [field, change] of Object.entries(value)) {
    if (isChange(change)) changes[field] = change;
  }

  return changes;
}

function isChange(value: unknown): value is AuditChange {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;

  return typeof value === 'object' && 'masked' in value && typeof value.masked === 'string';
}

function extensionsOf(value: unknown): AuditEntryExtensionValues {
  return typeof value === 'object' && value !== null ? value : {};
}
