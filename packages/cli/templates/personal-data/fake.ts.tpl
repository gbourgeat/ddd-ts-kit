import type { {{personal.names.port}} } from '{{alias.context}}/application/ports/{{personal.names.portKebab}}.port{{alias.ext}}';

/** Counts the rows each person has, as a test gave them, and forgets them at the first erasure. */
export class {{personal.names.fake}} implements {{personal.names.port}} {
  readonly name = '{{context.kebab}}';

  readonly erased: string[] = [];

  private readonly rows = new Map<string, number>();

  /** The rows the erasure of this person reaches, as the test arranges them. */
  holds(subject: string, rows: number): this {
    this.rows.set(subject, rows);

    return this;
  }

  async erase(subject: string): Promise<number> {
    const reached = this.rows.get(subject) ?? 0;

    this.rows.delete(subject);
    this.erased.push(subject);

    return reached;
  }
}
