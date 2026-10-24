import type { IntegrationEvent } from '../events/integration-event';
import type { Result } from '../../domain/result/result';
import type { DataSubjectErasedParseError } from './data-subject-erased-parse-error';
import type { DataSubjectErasedPayload } from './data-subject-erased-payload';
import type { PayloadIssue } from './payload-issue';

/**
 * The declaration of `privacy.data-subject.erased`, shaped as a definition of `@ddd-ts-kit/events`
 * is, so that its registry, its catalog, AsyncAPI, `on` and `consume` take it as they take any
 * other, and `@IntegrationEventHandler` and the container read it like the published language of a
 * context. It lives in the kernel because the application layer of every context handles it.
 */
export interface DataSubjectErasedDefinition {
  readonly type: 'privacy.data-subject.erased';
  readonly version: 1;
  readonly producer: 'privacy';
  readonly description: string;
  readonly deprecated: false;
  readonly payload: {
    parse(input: unknown): Result<DataSubjectErasedPayload, PayloadIssue[]>;
    toJsonSchema(): Record<string, unknown>;
  };
  /** Producer side: throws `InvalidDataSubjectErasedError` on an invalid payload, a name instead of an id first of all. */
  create(
    payload: DataSubjectErasedPayload,
    meta: {
      readonly id: string;
      readonly occurredAt: Date | string;
      readonly correlationId?: string;
      readonly traceparent?: string;
    },
  ): IntegrationEvent<DataSubjectErasedPayload>;
  /** Consumer side: checks type, version and payload, and never throws. */
  parse(event: IntegrationEvent): Result<IntegrationEvent<DataSubjectErasedPayload>, DataSubjectErasedParseError>;
  is(event: IntegrationEvent): event is IntegrationEvent<DataSubjectErasedPayload>;
}
