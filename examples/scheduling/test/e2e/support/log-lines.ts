/** One line the application logged, as the fields it wrote. */
export type LogLine = Readonly<Record<string, unknown>>;

/** A destination for the logger of the application that keeps what it is given: the lines a spec reads. */
export class LogLines {
  private readonly written: LogLine[] = [];

  /** Called by the logger with each serialized line. */
  write(line: string): void {
    const fields: unknown = JSON.parse(line);

    if (typeof fields === 'object' && fields !== null) this.written.push({ ...fields });
  }

  /** The lines written under one correlation id, in order. */
  of(correlationId: string): LogLine[] {
    return this.written.filter((line) => line['correlationId'] === correlationId);
  }
}
