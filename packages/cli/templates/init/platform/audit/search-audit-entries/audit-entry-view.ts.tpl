import { err, ok } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';
import { auditOutcomes } from '{{alias.platform}}/audit/search-audit-entries/audit-outcomes{{alias.ext}}';

/** What leaves the process: identifiers and codes, as the trail holds them. `changes` and `extensions` stay inside. */
export interface AuditEntryView {
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

/**
 * The schema of an entry in the contract. The check runs when the server validates what it
 * answers, on the fields that prove a value is an entry: the view is built by `auditEntryViewOf`,
 * never read from outside.
 */
export const auditEntrySchema = customSchema<AuditEntryView>(
  (input) =>
    isEntryView(input) ? ok(input) : err([{ path: '', code: 'invalid_type', message: 'Expected an audit entry.' }]),
  {
    type: 'object',
    required: [
      'id',
      'chain',
      'sequence',
      'occurredAt',
      'category',
      'action',
      'outcome',
      'actorId',
      'actorType',
      'correlationId',
      'origin',
      'previousHash',
      'hash',
    ],
    properties: {
      id: text,
      chain: text,
      sequence: { type: 'integer', minimum: 1 },
      occurredAt: { type: 'string', format: 'date-time' },
      category: text,
      action: text,
      outcome: { type: 'string', enum: [...auditOutcomes] },
      reason: text,
      actorId: text,
      actorType: text,
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
  },
);

function isEntryView(input: unknown): input is AuditEntryView {
  return (
    isRecord(input) &&
    typeof input['id'] === 'string' &&
    typeof input['hash'] === 'string' &&
    typeof input['sequence'] === 'number'
  );
}

function isRecord(input: unknown): input is Readonly<Record<string, unknown>> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
