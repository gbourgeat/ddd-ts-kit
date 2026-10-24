import { ERASED_PERSONAL_DATA, expiredBefore, type PersonalDataRetention, type Retention } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';
import { ContractSuite } from './contract-suite';
import type { PersonalDataUnderContract } from './personal-data/personal-data-under-contract';

export interface PersonalDataRetentionUnderContract<Row> extends PersonalDataUnderContract<Row> {
  /** The adapter under test, over a declaration that gives a retention. */
  readonly retention: PersonalDataRetention;
  /** A row about the subject whose retention runs from `at`, or never started when `at` is null. */
  aRowFrom(subject: string, n: number, at: Date | null): Row;
}

export interface PersonalDataRetentionContractOptions<Row> {
  readonly name: string;
  /** A fresh subject over an empty table; called before each test. */
  create(): Awaitable<PersonalDataRetentionUnderContract<Row>>;
}

const NOW = new Date('2026-06-15T12:00:00.000Z');
const A_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What every adapter of `PersonalDataRetention` over a `personalFields` declaration with a
 * retention guarantees, the in-memory one included: the rows whose retention ended are erased as
 * the declaration says, the others are left, a row whose date is empty never expires, and nothing
 * is reached twice.
 */
export function personalDataRetentionContract<Row extends object>(
  runner: ContractRunner,
  options: PersonalDataRetentionContractOptions<Row>,
): void {
  new PersonalDataRetentionSuite(runner, options).describe(`${options.name} (personal data retention contract)`);
}

class PersonalDataRetentionSuite<Row extends object> extends ContractSuite<PersonalDataRetentionUnderContract<Row>> {
  constructor(runner: ContractRunner, options: PersonalDataRetentionContractOptions<Row>) {
    super(runner, () => options.create());
  }

  protected tests(): void {
    this.purgesWhatOutlivedItsRetention();
    this.keepsTheRest();
    this.reachesNothingTwice();
  }

  private purgesWhatOutlivedItsRetention(): void {
    this.it('erases the rows whose retention ended, as the declaration says, and answers how many', async () => {
      const { retention, declaration } = this.subject;

      await this.subject.insert([this.expiredRowOf('ada', 1), this.recentRowOf('bob', 1), this.expiredRowOf('cy', 1)]);

      this.expect(await retention.purgeExpired(NOW)).toBe(2);

      const ada = await this.subject.rowsOf('ada');

      if (declaration.erasure === 'row') {
        this.expect(ada).toEqual([]);
      } else {
        this.expect(ada.map((row) => readsErased(row, declaration.fields))).toEqual([true]);
      }
    });
  }

  private keepsTheRest(): void {
    this.it('leaves a row still within its retention and a row whose retention never started', async () => {
      const recent = this.recentRowOf('bob', 1);
      const open = this.subject.aRowFrom('bob', 2, null);

      await this.subject.insert([recent, open]);

      this.expect(await this.subject.retention.purgeExpired(NOW)).toBe(0);
      this.expect(await this.subject.rowsOf('bob')).toEqual([recent, open]);
    });
  }

  private reachesNothingTwice(): void {
    this.it('reaches nothing the second time: a purge is safe to run again', async () => {
      await this.subject.insert([this.expiredRowOf('ada', 1)]);
      await this.subject.retention.purgeExpired(NOW);

      this.expect(await this.subject.retention.purgeExpired(NOW)).toBe(0);
    });
  }

  /** A day past the end of the retention the declaration gives. */
  private expiredRowOf(subject: string, n: number): Row {
    return this.subject.aRowFrom(
      subject,
      n,
      new Date(cutoffOf(this.subject.declaration.retention).getTime() - A_DAY_MS),
    );
  }

  /** A day within the retention. */
  private recentRowOf(subject: string, n: number): Row {
    return this.subject.aRowFrom(
      subject,
      n,
      new Date(cutoffOf(this.subject.declaration.retention).getTime() + A_DAY_MS),
    );
  }
}

function cutoffOf<Row>(retention: Retention<Row> | undefined): Date {
  if (retention === undefined) {
    throw new Error('The declaration under the retention contract gives no retention');
  }

  return expiredBefore(retention, NOW);
}

/** Every personal text of the row reads erased, every other personal field nothing. */
function readsErased(row: object, fields: readonly string[]): boolean {
  return fields.every((field) => {
    const value: unknown = Reflect.get(row, field);

    return value === ERASED_PERSONAL_DATA || value === null;
  });
}
