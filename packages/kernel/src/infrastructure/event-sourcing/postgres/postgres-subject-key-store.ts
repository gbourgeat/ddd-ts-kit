import { randomBytes, randomUUID } from 'node:crypto';
import type { SubjectKey } from '../../../application/event-sourcing/subject-key';
import type { SubjectKeyStore } from '../../../application/ports/subject-key-store';
import type { SqlRun } from '../../read-model/sql-run';
import type { EventStoreTablesOptions } from './event-store-tables-options';
import { qualifiedTable } from './qualified-table';

type Row = Readonly<Record<string, unknown>>;

/**
 * The keys of the data subjects on PostgreSQL: one row per subject, deleted by an erasure. A
 * deleted row is gone from the table at once, and from the backups as they expire. In the
 * database of the events, a backup older than an erasure holds both the sealed values and their
 * key: in production give this store a `SqlRun` of another database, backed up with a shorter
 * retention than the events.
 */
export class PostgresSubjectKeyStore implements SubjectKeyStore {
  private readonly table: string;

  constructor(
    private readonly run: SqlRun,
    options: EventStoreTablesOptions = {},
  ) {
    this.table = qualifiedTable(options.schema, 'subjectKeys');
  }

  async keyFor(subject: string): Promise<SubjectKey> {
    const held = await this.held(subject);

    if (held !== undefined) {
      return held;
    }

    await this.run(
      `insert into ${this.table} (subject, key_id, material) values ($1::text, $2::text, $3::text) on conflict (subject) do nothing`,
      [subject, randomUUID(), randomBytes(32).toString('base64')],
    );

    const created = await this.held(subject);

    if (created === undefined) {
      throw new TypeError(`The key of ${subject} was erased while it was being created`);
    }

    return created;
  }

  async find(keyId: string): Promise<SubjectKey | undefined> {
    const [row] = await this.run(`select subject, key_id, material from ${this.table} where key_id = $1::text`, [
      keyId,
    ]);

    return row === undefined ? undefined : keyOf(row);
  }

  async erase(subject: string): Promise<boolean> {
    return (
      (await this.run(`delete from ${this.table} where subject = $1::text returning subject`, [subject])).length > 0
    );
  }

  private async held(subject: string): Promise<SubjectKey | undefined> {
    const [row] = await this.run(`select subject, key_id, material from ${this.table} where subject = $1::text`, [
      subject,
    ]);

    return row === undefined ? undefined : keyOf(row);
  }
}

function keyOf(row: Row): SubjectKey {
  return { id: String(row['key_id']), subject: String(row['subject']), material: String(row['material']) };
}
