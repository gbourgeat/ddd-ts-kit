import type { Result } from '../../domain/result/result';
import type { PayloadIssue } from '../personal-data/payload-issue';

/**
 * How the worker reads the payload a queue kept for a background job, before each run: the
 * static `payload` of the class, next to its `jobName`. A payload enqueued before a deploy that
 * changed its shape is refused there, never run as the new type. The `Schema` of
 * `@ddd-ts-kit/validation` is one, whatever library it adapts (zod, class-validator, TypeBox,
 * Standard Schema); a project without a validation library writes `parse` by hand.
 */
export interface BackgroundJobPayloadSchema<Payload> {
  /** The payload as the job reads it, or what does not fit, field by field. */
  parse(input: unknown): Result<Payload, PayloadIssue[]>;
}
