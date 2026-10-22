import { afterEach, beforeEach, describe, expect, it, onTestFailed } from 'vitest';
import { defineBuilder, resetSequences, sequence } from '../src';
import {
  createDataGenerator,
  dataGenerator,
  generated,
  replayHint,
  reportSeedOnFailure,
  useDataGenerator,
} from '../src/faker';
import { anOrder } from './support/builders';

interface Customer {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly birthDate: Date;
}

const aCustomer = defineBuilder<Customer>({
  defaults: {
    id: sequence('customer'),
    name: generated((faker) => faker.person.fullName()),
    email: generated((faker) => faker.internet.email().toLowerCase()),
    birthDate: generated((faker) => faker.date.birthdate({ mode: 'age', min: 18, max: 90 })),
  },
});

// The real hooks, as a project wires them. Nothing is printed while the file passes.
reportSeedOnFailure({ beforeEach, onTestFailed });

beforeEach(() => {
  resetSequences();
  useDataGenerator(createDataGenerator({ seed: 2026 }));
});

describe('generated', () => {
  it('gives every build its own values, valid for the field', () => {
    const [first, second] = aCustomer().buildMany(2);

    expect(first?.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
    expect(second?.email).not.toBe(first?.email);
    expect(second?.name).not.toBe(first?.name);
  });

  it('replays the same sequence from the same seed', () => {
    const firstRun = aCustomer().buildMany(3);

    resetSequences();
    useDataGenerator(createDataGenerator({ seed: 2026 }));

    expect(aCustomer().buildMany(3)).toEqual(firstRun);
  });

  it('replays relative dates too, whatever the day the suite runs', () => {
    const born = aCustomer().build().birthDate;

    dataGenerator().restart();

    expect(aCustomer().build().birthDate).toEqual(born);
    expect(born.getUTCFullYear()).toBeLessThanOrEqual(2008);
  });

  it('gives another sequence for another seed', () => {
    const one = aCustomer().build();

    useDataGenerator(createDataGenerator({ seed: 2027 }));

    expect(aCustomer().build().email).not.toBe(one.email);
  });

  it('draws nothing for a field the test states', () => {
    const firstEmailOfTheSeed = createDataGenerator({ seed: 2026 }).faker.internet.email().toLowerCase();

    const customer = aCustomer().with('name', 'Ada Lovelace').build();

    expect(customer.name).toBe('Ada Lovelace');
    expect(customer.email).toBe(firstEmailOfTheSeed);
  });

  it('is accepted as a `with` value and by the builder of an aggregate', () => {
    const anonymous = aCustomer().with(
      'name',
      generated((faker) => faker.string.alpha(12)),
    );

    const order = anOrder().placedBy(generated((faker) => ({ id: faker.string.uuid(), name: 'Ada' })));

    expect(anonymous.build().name).toMatch(/^[A-Za-z]{12}$/);
    expect(order.build().toSnapshot().customer.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(order.build().toSnapshot().customer.id).not.toBe(order.build().toSnapshot().customer.id);
  });
});

describe('createDataGenerator', () => {
  const inherited = process.env.TEST_SEED;

  afterEach(() => {
    if (inherited === undefined) {
      delete process.env.TEST_SEED;
    } else {
      process.env.TEST_SEED = inherited;
    }
  });

  it('takes its seed from TEST_SEED when none is given', () => {
    process.env.TEST_SEED = '777';

    expect(createDataGenerator().seed).toBe(777);
    expect(createDataGenerator({ seed: 5 }).seed).toBe(5);
  });

  it('refuses a TEST_SEED that is not an integer', () => {
    process.env.TEST_SEED = 'tuesday';

    expect(() => createDataGenerator()).toThrow('TEST_SEED must be an integer, got "tuesday"');
  });

  it('draws a seed at random otherwise, and tells it so the run can be replayed', () => {
    delete process.env.TEST_SEED;
    const original = createDataGenerator();
    const drawn = original.faker.internet.email();

    const replay = createDataGenerator({ seed: original.seed });

    expect(Number.isSafeInteger(original.seed)).toBe(true);
    expect(replay.faker.internet.email()).toBe(drawn);
  });

  it('exposes the faker instance for a value no builder covers', () => {
    const { faker } = createDataGenerator({ seed: 1 });

    expect(faker.number.int({ min: 1, max: 6 })).toBeGreaterThanOrEqual(1);
  });
});

describe('reportSeedOnFailure', () => {
  it('prints the seed and how to replay under a failed test, and nothing under a passed one', () => {
    const printed: string[] = [];
    const runner = new RecordingRunner();

    reportSeedOnFailure(runner, (message) => printed.push(message));

    runner.runTest({ fails: false });
    expect(printed).toEqual([]);

    runner.runTest({ fails: true });
    expect(printed).toEqual(['Generated data seed: 2026. Replay this file with TEST_SEED=2026.']);
    expect(replayHint(7)).toContain('TEST_SEED=7');
  });
});

/** A runner reduced to what the helper touches: hooks before a test, reports after a failed one. */
class RecordingRunner {
  private readonly setups: (() => void)[] = [];

  private reports: (() => void)[] = [];

  readonly beforeEach = (setup: () => void): void => void this.setups.push(setup);

  readonly onTestFailed = (report: () => void): void => void this.reports.push(report);

  runTest({ fails }: { fails: boolean }): void {
    this.reports = [];

    for (const setup of this.setups) {
      setup();
    }

    if (fails) {
      for (const report of this.reports) {
        report();
      }
    }
  }
}
