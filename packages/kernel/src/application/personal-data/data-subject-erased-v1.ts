import type { IntegrationEvent } from '../events/integration-event';
import { err } from '../../domain/result/err';
import { ok } from '../../domain/result/ok';
import type { Result } from '../../domain/result/result';
import type { DataSubjectErasedDefinition } from './data-subject-erased-definition';
import type { DataSubjectErasedParseError } from './data-subject-erased-parse-error';
import type { DataSubjectErasedPayload } from './data-subject-erased-payload';
import { InvalidDataSubjectErasedError } from './invalid-data-subject-erased-error';
import { isDataSubjectId } from './is-data-subject-id';
import type { PayloadIssue } from './payload-issue';

const TYPE = 'privacy.data-subject.erased';
const VERSION = 1;

/**
 * The erasure of a data subject, published by the platform through the outbox once every copy it
 * reaches is erased (GDPR articles 17 and 19): a context that runs as a service of its own, or a
 * system that copied personal data from an integration event, erases its copy on its side, with
 * the handler `generate erasure-handler <context>` writes. The payload names the person by the
 * opaque id alone, and no operator: the event erases nothing by itself and carries nothing to erase,
 * and who asked stays in the audit trail, which its correlation id leads to. A copy already
 * gone (a message in a dead letter queue, a topic) is bounded by the retention of the broker, as a
 * backup is by its own.
 */
export const dataSubjectErasedV1: DataSubjectErasedDefinition = {
  type: TYPE,
  version: VERSION,
  producer: 'privacy',
  description: 'Every copy the platform reaches of a data subject is erased: erase yours.',
  deprecated: false,
  payload: { parse: parsePayload, toJsonSchema: jsonSchema },
  create(payload, meta) {
    const parsed = parsePayload(payload);

    if (!parsed.ok) {
      throw new InvalidDataSubjectErasedError(parsed.error);
    }

    const occurredAt = typeof meta.occurredAt === 'string' ? meta.occurredAt : meta.occurredAt.toISOString();

    return {
      id: meta.id,
      type: TYPE,
      version: VERSION,
      occurredAt,
      payload: parsed.value,
      ...(meta.traceparent === undefined ? {} : { traceparent: meta.traceparent }),
      ...(meta.correlationId === undefined ? {} : { correlationId: meta.correlationId }),
    };
  },
  parse: parseEvent,
  is(event): event is IntegrationEvent<DataSubjectErasedPayload> {
    return event.type === TYPE && event.version === VERSION;
  },
};

function parseEvent(
  event: IntegrationEvent,
): Result<IntegrationEvent<DataSubjectErasedPayload>, DataSubjectErasedParseError> {
  if (event.type !== TYPE) {
    return err({ reason: 'type-mismatch', expected: TYPE, actual: event.type });
  }

  if (event.version !== VERSION) {
    return err({ reason: 'version-mismatch', expected: VERSION, actual: event.version });
  }

  const payload = parsePayload(event.payload);

  return payload.ok
    ? ok({ ...event, payload: payload.value })
    : err({ reason: 'invalid-payload', issues: payload.error });
}

function parsePayload(input: unknown): Result<DataSubjectErasedPayload, PayloadIssue[]> {
  const subjectId = textOf(input, 'subjectId');
  const erasedAt = textOf(input, 'erasedAt');

  const issues = [
    ...(isDataSubjectId(subjectId) ? [] : [issue('subjectId', 'is not the opaque identifier of a data subject')]),
    ...(erasedAt !== undefined && !Number.isNaN(Date.parse(erasedAt)) ? [] : [issue('erasedAt', 'is not an instant')]),
  ];

  if (subjectId === undefined || erasedAt === undefined || issues.length > 0) {
    return err(issues);
  }

  return ok({ subjectId, erasedAt });
}

function textOf(input: unknown, name: string): string | undefined {
  const value: unknown = typeof input === 'object' && input !== null ? Reflect.get(input, name) : undefined;

  return typeof value === 'string' ? value : undefined;
}

function issue(path: string, message: string): PayloadIssue {
  return { path, code: 'invalid', message: `${path} ${message}` };
}

function jsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    required: ['subjectId', 'erasedAt'],
    additionalProperties: false,
    properties: {
      subjectId: { type: 'string', description: 'The opaque identifier of the data subject.' },
      erasedAt: { type: 'string', format: 'date-time', description: 'When the platform erased its copies.' },
    },
  };
}
