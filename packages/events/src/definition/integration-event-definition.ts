import type { IntegrationEvent, Result } from '@ddd-ts-kit/kernel';
import type { Schema } from '@ddd-ts-kit/validation';
import type { EventMeta } from './event-meta';
import type { EventParseError } from './event-parse-error';
import type { PersonalPayload } from './personal-payload';

/** The single declaration of an integration event: its type, its version and its payload contract. */
export interface IntegrationEventDefinition<P> {
  readonly type: string;
  readonly version: number;
  readonly payload: Schema<P>;
  readonly producer: string;
  readonly description?: string;
  readonly deprecated: boolean;
  /** The fields of the payload that hold personal data, and whose; absent when the payload holds none. */
  readonly personal?: PersonalPayload;
  /** Producer side. Throws InvalidEventPayloadError: publishing an invalid event is a bug. */
  create(payload: P, meta: EventMeta): IntegrationEvent<P>;
  /** Consumer side. Checks type, version and payload, and never throws. */
  parse(event: IntegrationEvent): Result<IntegrationEvent<P>, EventParseError>;
  /** Cheap guard on type and version only. Use `parse` when the payload is not trusted. */
  is(event: IntegrationEvent): event is IntegrationEvent<P>;
}
