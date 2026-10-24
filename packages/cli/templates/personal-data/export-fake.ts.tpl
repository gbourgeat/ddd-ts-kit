import type { PersonalDataRecord } from '@ddd-ts-kit/kernel';
import type { {{personal.names.exportPort}} } from '{{alias.context}}/application/ports/{{personal.names.exportPortKebab}}.port{{alias.ext}}';

/** Hands over the records a test gave it of each person, and remembers who was asked. */
export class {{personal.names.exportFake}} implements {{personal.names.exportPort}} {
  readonly name = '{{context.kebab}}';

  readonly asked: string[] = [];

  private readonly records = new Map<string, PersonalDataRecord[]>();

  /** What the export of this person hands over, as the test arranges it. */
  holds(subject: string, ...records: readonly PersonalDataRecord[]): this {
    this.records.set(subject, [...(this.records.get(subject) ?? []), ...records]);

    return this;
  }

  async exportOf(subject: string): Promise<readonly PersonalDataRecord[]> {
    this.asked.push(subject);

    return this.records.get(subject) ?? [];
  }
}
