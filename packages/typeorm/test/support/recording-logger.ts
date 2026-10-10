import type { Logger } from 'typeorm';

/** A TypeORM logger that keeps the SQL it was given, to assert what was really sent. */
export class RecordingLogger implements Logger {
  readonly queries: string[] = [];

  logQuery(query: string): void {
    this.queries.push(query);
  }

  logQueryError(): void {}

  logQuerySlow(): void {}

  logSchemaBuild(): void {}

  logMigration(): void {}

  log(): void {}
}
