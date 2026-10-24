import { personalDataValueOf, type PersonalDataExport } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { ContractSuite } from './contract-suite';
import type { PersonalDataUnderContract } from './personal-data/personal-data-under-contract';

export interface PersonalDataExportUnderContract<Row> extends PersonalDataUnderContract<Row> {
  /** The adapter under test, over the declaration. */
  readonly exporter: PersonalDataExport;
}

export interface PersonalDataExportContractOptions<Row> {
  readonly name: string;
  /** A fresh subject over an empty table; called before each test. */
  create(): Awaitable<PersonalDataExportUnderContract<Row>>;
}

/**
 * What every adapter of `PersonalDataExport` over a `personalFields` declaration guarantees: one
 * record per row about the subject, under the name of the exporter (or that name and the table,
 * `<name>.<table>`, when the exporter reads several tables), holding each personal column and each
 * file column as plain data, no other column, and nothing of anyone else.
 */
export function personalDataExportContract<Row extends object>(
  runner: ContractRunner,
  options: PersonalDataExportContractOptions<Row>,
): void {
  new PersonalDataExportSuite(runner, options).describe(`${options.name} (personal data export contract)`);
}

class PersonalDataExportSuite<Row extends object> extends ContractSuite<PersonalDataExportUnderContract<Row>> {
  constructor(runner: ContractRunner, options: PersonalDataExportContractOptions<Row>) {
    super(runner, () => options.create());
  }

  protected tests(): void {
    this.answersEveryRowOfTheSubject();
    this.namesTheSourceOfEveryRecord();
    this.answersNothingForAStranger();
  }

  private answersEveryRowOfTheSubject(): void {
    this.it(
      'answers one record per row about the subject, with each personal column and file column as plain data, and no other',
      async () => {
        const { exporter, declaration } = this.subject;
        const first = this.subject.aRowOf('ada', 1);
        const second = this.subject.aRowOf('ada', 2);

        await this.subject.insert([first, this.subject.aRowOf('bob', 1), second]);

        const records = await exporter.exportOf('ada');

        this.expect(records.map(({ values }) => values)).toEqual(
          [first, second].map((row) =>
            Object.fromEntries(
              [...declaration.fields, ...declaration.files].map((column) => [
                column,
                personalDataValueOf(columnOf(row, column)),
              ]),
            ),
          ),
        );
      },
    );
  }

  private namesTheSourceOfEveryRecord(): void {
    this.it('names the source of every record after the exporter, alone or followed by the table', async () => {
      const { exporter } = this.subject;

      await this.subject.insert([this.subject.aRowOf('ada', 1), this.subject.aRowOf('ada', 2)]);

      const sources = (await exporter.exportOf('ada')).map(({ source }) => source);

      this.expect(sources).toEqual([sources[0], sources[0]]);
      this.expect(sources[0] === exporter.name || sources[0]?.startsWith(`${exporter.name}.`)).toBe(true);
    });
  }

  private answersNothingForAStranger(): void {
    this.it('answers nothing for a subject the table knows nothing of', async () => {
      await this.subject.insert([this.subject.aRowOf('bob', 1)]);

      this.expect(await this.subject.exporter.exportOf('ada')).toEqual([]);
    });
  }
}

/** The value of one column of a row, whatever the type of the row: read, never asserted. */
function columnOf(row: object, column: string): unknown {
  const value: unknown = Reflect.get(row, column);

  return value;
}
