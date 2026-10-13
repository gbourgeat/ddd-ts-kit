import type { EventToAppend } from '../../application/event-sourcing/event-to-append.js';
import type { StoredData } from '../../application/event-sourcing/stored-data.js';
import { StoredEventData } from '../../application/event-sourcing/stored-event-data.js';
import type { StoredEventType } from '../../application/event-sourcing/stored-event-type.js';
import type { StoredEventTypes } from '../../application/event-sourcing/stored-event-types.js';
import type { StoredEvent } from '../../application/event-sourcing/stored-event.js';
import { UnreadableEventError } from '../../application/event-sourcing/unreadable-event-error.js';
import type { IdGenerator } from '../../application/ports/id-generator.js';
import type { DomainEvent } from '../../domain/domain-event.js';
import { UuidGenerator } from '../id/uuid-generator.js';
import { PersonalDataCipher } from './personal-data-cipher.js';
import { storedOrigins } from './stored-origins.js';

export interface EventSerializerOptions {
  /** Seals and opens the personal values; without one, data holding a personal value is refused. */
  readonly cipher?: PersonalDataCipher;
  /** Gives each stored event its id. Default: a UUID. */
  readonly ids?: IdGenerator;
}

/**
 * Turns the domain events of one aggregate into stored events and back, as `defineStoredEvent`
 * declared them: the current version of their shape on the way in, and on the way out the
 * upcasters from the version they were stored with, then `decode`. Stored events are never
 * rewritten. Personal values are sealed on the way in and opened on the way out.
 */
export class EventSerializer<E extends DomainEvent> {
  private readonly types = new Map<string, StoredEventType<E>>();

  private readonly ids: IdGenerator;

  constructor(
    types: StoredEventTypes<E>,
    private readonly options: EventSerializerOptions = {},
  ) {
    for (const name of Object.keys(types)) {
      const declared: unknown = Reflect.get(types, name);

      if (isStoredEventType<E>(declared)) {
        this.types.set(name, declared);
      }
    }

    this.ids = options.ids ?? new UuidGenerator();
  }

  /** Whether events of this name are declared here: what a subscription skips otherwise. */
  declares(type: string): boolean {
    return this.types.has(type);
  }

  async serialize(event: DomainEvent): Promise<EventToAppend> {
    const declared = this.typeOf(event.name);

    return {
      id: this.ids.next(),
      type: event.name,
      schemaVersion: declared.version,
      data: await this.seal(declared.encode(event)),
      metadata: { aggregateId: event.aggregateId },
      occurredAt: event.occurredAt,
    };
  }

  async deserialize(stored: StoredEvent): Promise<E> {
    const declared = this.typeOf(stored.type);
    const where = `${stored.type} ${stored.id}`;
    const data = upcast(declared, await this.open(stored.data), stored);

    const event = declared.decode(new StoredEventData(data, where), {
      id: stored.id,
      aggregateId: aggregateIdOf(stored),
      occurredAt: stored.occurredAt,
      version: stored.version,
    });

    storedOrigins.set(event, stored);

    return event;
  }

  /** Seals the personal values of the data, for an event or a snapshot. */
  async seal(data: StoredData): Promise<StoredData> {
    if (!PersonalDataCipher.holdsPersonalData(data)) {
      return data;
    }

    if (this.options.cipher === undefined) {
      throw new TypeError('Personal data is stored sealed: give the serializer a PersonalDataCipher');
    }

    return this.options.cipher.seal(data);
  }

  /** Opens the sealed values of the data; an erased one reads `ERASED_PERSONAL_DATA`. */
  async open(data: StoredData): Promise<StoredData> {
    if (!PersonalDataCipher.holdsPersonalData(data)) {
      return data;
    }

    if (this.options.cipher === undefined) {
      throw new UnreadableEventError('Stored data holds sealed values: give the serializer a PersonalDataCipher');
    }

    return this.options.cipher.open(data);
  }

  private typeOf(type: string): StoredEventType<E> {
    const declared = this.types.get(type);

    if (declared === undefined) {
      throw new UnreadableEventError(
        `"${type}" is not a stored event of this serializer: declare it with defineStoredEvent`,
      );
    }

    return declared;
  }
}

/** What `defineStoredEvent` answers, told apart from anything else a record of declarations could hold. */
function isStoredEventType<E extends DomainEvent>(value: unknown): value is StoredEventType<E> {
  return typeof value === 'object' && value !== null && 'decode' in value && 'encode' in value && 'version' in value;
}

function upcast(declared: StoredEventType<DomainEvent>, data: StoredData, stored: StoredEvent): StoredData {
  if (stored.schemaVersion > declared.version) {
    throw new UnreadableEventError(
      `${stored.type} ${stored.id} is stored in version ${stored.schemaVersion}, and this release reads up to ${declared.version}`,
    );
  }

  let current = data;

  for (let version = stored.schemaVersion; version < declared.version; version += 1) {
    const upcaster = declared.upcasters[version];

    if (upcaster === undefined) {
      throw new UnreadableEventError(`${stored.type} has no upcaster from version ${version}`);
    }

    current = upcaster(current);
  }

  return current;
}

function aggregateIdOf(stored: StoredEvent): string {
  const declared = stored.metadata['aggregateId'];

  return typeof declared === 'string' ? declared : stored.stream;
}
