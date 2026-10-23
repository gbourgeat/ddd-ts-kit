import { err, ok, type IntegrationEvent, type Result } from '@ddd-ts-kit/kernel';
import type { Schema } from '@ddd-ts-kit/validation';
import type { EventMeta } from './event-meta';
import type { EventParseError } from './event-parse-error';
import type { IntegrationEventDefinition } from './integration-event-definition';
import { InvalidEventDefinitionError } from './invalid-event-definition-error';
import { InvalidEventPayloadError } from './invalid-event-payload-error';

export interface DefineIntegrationEventOptions<P> {
  /** Routing key, `<context>.<aggregate>.<fact>`, each segment in kebab-case. */
  readonly type: string;
  /** Positive integer, bumped on every breaking change of the payload. */
  readonly version: number;
  readonly payload: Schema<P>;
  readonly description?: string;
  /** The bounded context that owns the event. Defaults to the first segment of `type`. */
  readonly producer?: string;
  readonly deprecated?: boolean;
}

export function defineIntegrationEvent<P>(options: DefineIntegrationEventOptions<P>): IntegrationEventDefinition<P> {
  const { type, version, payload } = options;

  assertTypeAndVersion(type, version);

  const contract: EventContract<P> = { type, version, payload };

  return {
    ...contract,
    producer: producerOf(options),
    ...(options.description === undefined ? {} : { description: options.description }),
    deprecated: options.deprecated === true,
    create: (input, meta) => createEvent(contract, input, meta),
    parse: (event) => parseEvent(contract, event),
    is(event): event is IntegrationEvent<P> {
      return event.type === type && event.version === version;
    },
  };
}

type EventContract<P> = Pick<IntegrationEventDefinition<P>, 'type' | 'version' | 'payload'>;

const SEGMENT = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
const EVENT_TYPE = new RegExp(`^${SEGMENT}\\.${SEGMENT}\\.${SEGMENT}$`);
const KEBAB_CASE = new RegExp(`^${SEGMENT}$`);

function assertTypeAndVersion(type: string, version: number): void {
  if (!EVENT_TYPE.test(type)) {
    throw new InvalidEventDefinitionError(
      `Event type "${type}" must be <context>.<aggregate>.<fact> with kebab-case segments`,
    );
  }

  if (!Number.isInteger(version) || version < 1) {
    throw new InvalidEventDefinitionError(`Version of ${type} must be a positive integer`);
  }
}

function producerOf({ type, producer }: DefineIntegrationEventOptions<unknown>): string {
  const name = producer ?? type.slice(0, type.indexOf('.'));

  if (!KEBAB_CASE.test(name)) {
    throw new InvalidEventDefinitionError(`Producer of ${type} must be a kebab-case context name`);
  }

  return name;
}

function createEvent<P>({ type, version, payload }: EventContract<P>, input: P, meta: EventMeta): IntegrationEvent<P> {
  const parsed = payload.parse(input);

  if (!parsed.ok) {
    throw new InvalidEventPayloadError(type, version, parsed.error);
  }

  return {
    id: meta.id,
    type,
    version,
    occurredAt: isoInstant(type, meta.occurredAt),
    payload: parsed.value,
    ...(meta.traceparent === undefined ? {} : { traceparent: meta.traceparent }),
    ...(meta.correlationId === undefined ? {} : { correlationId: meta.correlationId }),
  };
}

function isoInstant(type: string, occurredAt: Date | string): string {
  const date = typeof occurredAt === 'string' ? new Date(occurredAt) : occurredAt;

  if (Number.isNaN(date.getTime())) {
    throw new InvalidEventDefinitionError(`occurredAt of ${type} is not a valid date`);
  }

  return typeof occurredAt === 'string' ? occurredAt : date.toISOString();
}

function parseEvent<P>(
  { type, version, payload }: EventContract<P>,
  event: IntegrationEvent,
): Result<IntegrationEvent<P>, EventParseError> {
  if (event.type !== type) {
    return err({ reason: 'type-mismatch', expected: type, actual: event.type });
  }

  if (event.version !== version) {
    return err({ reason: 'version-mismatch', expected: version, actual: event.version });
  }

  const parsed = payload.parse(event.payload);

  if (!parsed.ok) {
    return err({ reason: 'invalid-payload', issues: parsed.error });
  }

  return ok({ ...event, payload: parsed.value });
}
