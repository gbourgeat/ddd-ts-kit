import { ERASED_PERSONAL_DATA, type PersonalDataCopy } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { ContractSuite } from './contract-suite';
import type { PersonalDataUnderContract } from './personal-data/personal-data-under-contract';

export interface PersonalDataErasureUnderContract<Row> extends PersonalDataUnderContract<Row> {
  /** The adapter under test, over the declaration. */
  readonly erasure: PersonalDataCopy;
}

export interface PersonalDataErasureContractOptions<Row> {
  readonly name: string;
  /** A fresh subject over an empty table; called before each test. */
  create(): Awaitable<PersonalDataErasureUnderContract<Row>>;
}

type Columns = Readonly<Record<string, unknown>>;

/**
 * What every adapter of `PersonalDataErasure` over a `personalFields` declaration guarantees, the
 * in-memory one included: the rows about the subject alone are reached, deleted or pseudonymised
 * as the declaration says, counted once, and never twice.
 */
export function personalDataErasureContract<Row extends object>(
  runner: ContractRunner,
  options: PersonalDataErasureContractOptions<Row>,
): void {
  new PersonalDataErasureSuite(runner, options).describe(`${options.name} (personal data erasure contract)`);
}

class PersonalDataErasureSuite<Row extends object> extends ContractSuite<PersonalDataErasureUnderContract<Row>> {
  constructor(runner: ContractRunner, options: PersonalDataErasureContractOptions<Row>) {
    super(runner, () => options.create());
  }

  protected tests(): void {
    this.reachesTheRowsOfTheSubjectAlone();
    this.leavesTheRowsOfTheOthers();
    this.reachesNothingTwice();
    this.reachesNothingForAStranger();
  }

  private reachesTheRowsOfTheSubjectAlone(): void {
    this.it('erases every row about the subject as the declaration says, and answers how many it reached', async () => {
      const { erasure, declaration } = this.subject;

      await this.subject.insert([
        this.subject.aRowOf('ada', 1),
        this.subject.aRowOf('bob', 1),
        this.subject.aRowOf('ada', 2),
      ]);

      this.expect(await erasure.erase('ada')).toBe(2);

      const left = await this.subject.rowsOf('ada');

      if (declaration.erasure === 'row') {
        this.expect(left).toEqual([]);
      } else {
        this.expect(left.map((row) => personalPartOf(row, declaration))).toEqual([
          erasedPartOf(declaration, this.subject.aRowOf('ada', 1)),
          erasedPartOf(declaration, this.subject.aRowOf('ada', 2)),
        ]);

        this.expect(left.map((row) => restOf(row, declaration))).toEqual([
          restOf(this.subject.aRowOf('ada', 1), declaration),
          restOf(this.subject.aRowOf('ada', 2), declaration),
        ]);
      }
    });
  }

  private leavesTheRowsOfTheOthers(): void {
    this.it('leaves the rows about everyone else as they were', async () => {
      await this.subject.insert([this.subject.aRowOf('ada', 1), this.subject.aRowOf('bob', 1)]);
      await this.subject.erasure.erase('ada');

      this.expect(await this.subject.rowsOf('bob')).toEqual([this.subject.aRowOf('bob', 1)]);
    });
  }

  private reachesNothingTwice(): void {
    this.it('reaches nothing the second time: an erasure is safe to run again', async () => {
      await this.subject.insert([this.subject.aRowOf('ada', 1)]);
      await this.subject.erasure.erase('ada');

      this.expect(await this.subject.erasure.erase('ada')).toBe(0);
    });
  }

  private reachesNothingForAStranger(): void {
    this.it('reaches nothing for a subject the table knows nothing of', async () => {
      await this.subject.insert([this.subject.aRowOf('bob', 1)]);

      this.expect(await this.subject.erasure.erase('ada')).toBe(0);
      this.expect(await this.subject.rowsOf('bob')).toEqual([this.subject.aRowOf('bob', 1)]);
    });
  }
}

/** The personal columns of a row: the fields and the file keys. */
function personalPartOf<Row extends object>(
  row: Row,
  { fields, files }: PersonalDataErasureUnderContract<Row>['declaration'],
): Columns {
  return Object.fromEntries([...fields, ...files].map((column) => [column, columnOf(row, column)]));
}

/** What the personal columns of a pseudonymised row read: erased for a text, nothing for anything else, nothing for a file. */
function erasedPartOf<Row extends object>(
  { fields, files }: PersonalDataErasureUnderContract<Row>['declaration'],
  before: Row,
): Columns {
  const erased: [string, unknown][] = [
    ...fields.map((field): [string, unknown] => [
      field,
      typeof before[field] === 'string' ? ERASED_PERSONAL_DATA : null,
    ]),
    ...files.map((file): [string, unknown] => [file, null]),
  ];

  return Object.fromEntries(erased);
}

/** Every column that is not personal: untouched by a pseudonymisation. */
function restOf<Row extends object>(
  row: Row,
  { fields, files }: PersonalDataErasureUnderContract<Row>['declaration'],
): Columns {
  const personal = new Set<string>([...fields, ...files]);

  return Object.fromEntries(Object.entries(row).filter(([column]) => !personal.has(column)));
}

/** The value of one column of a row, whatever the type of the row: read, never asserted. */
function columnOf(row: object, column: string): unknown {
  const value: unknown = Reflect.get(row, column);

  return value;
}
