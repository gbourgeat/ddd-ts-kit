import type { Logger } from 'drizzle-orm';

/** A drizzle logger that keeps the SQL it was given, to assert what was really sent. */
export class RecordingLogger implements Logger {
  readonly queries: string[] = [];

  logQuery(query: string): void {
    this.queries.push(query);
  }
}
