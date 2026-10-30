import type { SubjectKey } from '../../application/event-sourcing/subject-key';
import type { StoredEvent } from '../../application/event-sourcing/stored-event';
import type { PersonalDataRecord } from '../../application/personal-data/personal-data-record';
import type { EventStore } from '../../application/ports/event-store';
import type { ExecutionScope } from '../../application/ports/execution-scope';
import type { PersonalDataExport } from '../../application/ports/personal-data-export';
import type { SubjectKeyStore } from '../../application/ports/subject-key-store';
import { PersonalDataCipher } from './personal-data-cipher';

export interface EventStorePersonalDataExportOptions {
  /** The events whose sealed values are read. */
  readonly events: EventStore;
  /** The keys the values were sealed with: a value is the subject's when its key is. */
  readonly keys: SubjectKeyStore;
  /** The name of the export, which every record source starts with. Default `event-store`. */
  readonly name?: string;
  /**
   * With a scope, only the events of the tenant of the work: an export runs once in each tenant,
   * and the store is read whole each time. Left out, every event.
   */
  readonly scope?: ExecutionScope;
  /** Events read per round. Default 500. */
  readonly batchSize?: number;
}

/**
 * What the event store keeps of a person, for the right of access and to portability: one record
 * per event that holds a value sealed with `personalData(subject, value)` for the subject, under
 * `<name>.<event type>`, each value opened and named by its path in the data of the event. A value
 * whose key was destroyed by an erasure is gone and answers nothing. A stream is named after its
 * aggregate, not after the person, so the whole store is read, in rounds; the snapshots are left
 * out, being made of the same events.
 */
export class EventStorePersonalDataExport implements PersonalDataExport {
  readonly name: string;

  constructor(private readonly options: EventStorePersonalDataExportOptions) {
    this.name = options.name ?? 'event-store';
  }

  async exportOf(subject: string): Promise<readonly PersonalDataRecord[]> {
    const cipher = new PersonalDataCipher(this.options.keys);
    const find = rememberedKeys(this.options.keys);
    const records: PersonalDataRecord[] = [];

    for await (const event of this.eventsOfTheTenant()) {
      const values = await cipher.valuesOf(subject, event.data, find);

      if (Object.keys(values).length > 0) {
        records.push({ source: `${this.name}.${event.type}`, values });
      }
    }

    return records;
  }

  /** The whole store in the order of its positions, the events of the tenant of the work alone when there is a scope. */
  private async *eventsOfTheTenant(): AsyncGenerator<StoredEvent> {
    const { events, scope, batchSize = 500 } = this.options;
    const tenantId = scope?.current()?.tenantId;
    let position = 0;

    for (
      let read = await events.readAll(position, batchSize);
      read.length > 0;
      read = await events.readAll(position, batchSize)
    ) {
      for (const event of read) {
        position = event.position;

        if (scope === undefined || event.tenantId === tenantId) {
          yield event;
        }
      }
    }
  }
}

/** The lookup of a key that reads each one once, however many values it sealed. */
function rememberedKeys(keys: SubjectKeyStore): (keyId: string) => Promise<SubjectKey | undefined> {
  const found = new Map<string, Promise<SubjectKey | undefined>>();

  return (keyId) => {
    const key = found.get(keyId) ?? keys.find(keyId);

    found.set(keyId, key);

    return key;
  };
}
