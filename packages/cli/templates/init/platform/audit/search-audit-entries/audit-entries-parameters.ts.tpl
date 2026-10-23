import { pageRequestParameters } from '@ddd-ts-kit/http';
import { err, ok } from '@ddd-ts-kit/kernel';
import { customSchema, type JsonSchema } from '@ddd-ts-kit/validation';
import { auditOutcomes } from '{{alias.platform}}/audit/search-audit-entries/audit-outcomes{{alias.ext}}';

/** The query string of the endpoint, as the server receives it. */
export type AuditEntriesParameters = Readonly<Record<string, unknown>>;

/** Newest first unless asked otherwise, by cursor: the trail only grows, an offset would shift under the reader. */
export const auditPageLimits = { sortable: ['occurredAt', 'sequence'], maxSize: 100, kind: 'cursor' } as const;

/** What a reader may narrow the search by, and the page it asks for. */
export const auditEntriesParameters = customSchema<AuditEntriesParameters>(
  (input) =>
    isRecord(input) ? ok(input) : err([{ path: '', code: 'invalid_type', message: 'Expected query parameters.' }]),
  {
    type: 'object',
    properties: {
      ...propertiesOf(pageRequestParameters(auditPageLimits)),
      actorId: { type: 'string', description: 'Entries about what this actor did.' },
      action: { type: 'string', description: 'A permission id, a command name or an event type.' },
      outcome: { type: 'string', enum: [...auditOutcomes] },
      correlationId: { type: 'string', description: 'Everything one request or event caused.' },
    },
  },
);

function propertiesOf(schema: JsonSchema): JsonSchema {
  const { properties } = schema;

  return typeof properties === 'object' && properties !== null ? { ...properties } : {};
}

function isRecord(input: unknown): input is AuditEntriesParameters {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
