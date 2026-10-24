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

type Columns = Readonly<Record<string, unknown>>;

/**
 * What every adapter of `PersonalDataExport` over a `personalFields` declaration guarantees: one
 * record per row about the subject, under the name of the source, holding each personal column as
 * plain data, and nothing of anyone else.
 */
export function personalDataExportContract<Row extends Columns>(
  runner: ContractRunner,
  options: PersonalDataExportContractOptions<Row>,
): void {
  new PersonalDataExportSuite(runner, options).describe(`${options.name} (personal data export contract)`);
}

class PersonalDataExportSuite<Row extends Columns> extends ContractSuite<PersonalDataExportUnderContract<Row>> {
  constructor(runner: ContractRunner, options: PersonalDataExportContractOptions<Row>) {
    super(runner, () => options.create());
  }

  protected tests(): void {
    this.answersEveryRowOfTheSubject();
    this.answersNothingForAStranger();
  }

  private answersEveryRowOfTheSubject(): void {
    this.it(
      'answers one record per row about the subject, under the name of the source, with each personal column as plain data',
      async () => {
        const { exporter, declaration } = this.subject;
        const first = this.subject.aRowOf('ada', 1);
        const second = this.subject.aRowOf('ada', 2);

        await this.subject.insert([first, this.subject.aRowOf('bob', 1), second]);

        this.expect(await exporter.exportOf('ada')).toEqual(
          [first, second].map((row) => ({
            source: exporter.name,
            values: Object.fromEntries(
              [...declaration.fields, ...declaration.files].map((column) => [column, personalDataValueOf(row[column])]),
            ),
          })),
        );
      },
    );
  }

  private answersNothingForAStranger(): void {
    this.it('answers nothing for a subject the table knows nothing of', async () => {
      await this.subject.insert([this.subject.aRowOf('bob', 1)]);

      this.expect(await this.subject.exporter.exportOf('ada')).toEqual([]);
    });
  }
}
