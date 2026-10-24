import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { budgetLines, budgetSettings, levelOf, overBudget, REFERENCE_BUDGET, type TimedSpec } from '../src/budget';
import { JestDurationBudgetReporter } from '../src/budget/jest-duration-budget-reporter';
import { VitestDurationBudgetReporter } from '../src/budget/vitest-duration-budget-reporter';

const workspace = mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-budget-'));

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

/** A project on disk: its config file, given from its root. */
function projectWith(config: object): string {
  const root = mkdtempSync(path.join(workspace, 'project-'));

  writeFileSync(path.join(root, 'ddd-ts-kit.config.json'), JSON.stringify(config));

  return root;
}

const UNIT: TimedSpec = {
  file: 'src/contexts/billing/test/unit/invoice.aggregate.spec.ts',
  level: 'unit',
  duration: 812,
};

const SLOW_UNIT: TimedSpec = { file: 'src/contexts/billing/test/unit/money.vo.spec.ts', level: 'unit', duration: 6120 };

const INTEGRATION: TimedSpec = {
  file: 'src/contexts/billing/test/integration/invoice.repository.contract.spec.ts',
  level: 'integration',
  duration: 4200,
};

describe('the time budget of the specs', () => {
  it('holds a unit spec of a context and an integration spec to their level, and no spec of the application', () => {
    expect(levelOf('src/contexts/billing/test/unit/invoice.aggregate.spec.ts')).toBe('unit');
    expect(levelOf('src/contexts/billing/calendars/test/unit/slot.vo.spec.ts')).toBe('unit');

    expect(levelOf('src\\contexts\\billing\\test\\integration\\invoice.repository.contract.spec.ts')).toBe(
      'integration',
    );

    expect(levelOf('src/platform/auth/relationships/knex-relation-tuple-store.spec.ts')).toBe('integration');

    expect(levelOf('test/e2e/issue-invoice.e2e.spec.ts')).toBeUndefined();
    expect(levelOf('test/acceptance/us5.acceptance.spec.ts')).toBeUndefined();
    expect(levelOf('test/architecture/extractable.spec.ts')).toBeUndefined();
    expect(levelOf('src/contexts/billing/domain/aggregates/invoice.aggregate.ts')).toBeUndefined();
  });

  it('reads the budget of the config, the reference for a level it does not give or gives as no duration', () => {
    expect(budgetSettings(projectWith({})).budget).toEqual({ unit: 5000, integration: 30_000 });
    expect(budgetSettings(projectWith({ budget: { unit: 1500 } })).budget).toEqual({ unit: 1500, integration: 30_000 });
    expect(budgetSettings(projectWith({ budget: { unit: 'fast', integration: -1 } })).budget).toEqual(REFERENCE_BUDGET);
    expect(budgetSettings(projectWith({ budget: { unit: 1.5 } })).budget).toEqual(REFERENCE_BUDGET);
    expect(budgetSettings(projectWith({ budget: 'fast' })).budget).toEqual(REFERENCE_BUDGET);
    expect(() => budgetSettings(path.join(workspace, 'nowhere'))).toThrow(/ddd-ts-kit\.config\.json was not found/);
  });

  it('warns by default, and fails the run only once the config enforces the budget', () => {
    expect(budgetSettings(projectWith({})).enforced).toBe(false);
    expect(budgetSettings(projectWith({ budget: { enforce: 'yes' } })).enforced).toBe(false);
    expect(budgetSettings(projectWith({ budget: { enforce: true } })).enforced).toBe(true);
  });

  it('names the slowest spec of each level, and the specs over their budget, slowest first', () => {
    const reading = overBudget([UNIT, SLOW_UNIT, INTEGRATION], REFERENCE_BUDGET);

    expect(reading.slowest).toEqual({ unit: SLOW_UNIT, integration: INTEGRATION });
    expect(reading.over).toEqual([SLOW_UNIT]);
    expect(overBudget([UNIT, INTEGRATION], { unit: 500, integration: 4000 }).over).toEqual([INTEGRATION, UNIT]);
  });

  it('prints one line per level that ran, and names the specs over the budget and how a budget is raised, as a warning until it is enforced', () => {
    const held = budgetLines(overBudget([UNIT, INTEGRATION], REFERENCE_BUDGET), REFERENCE_BUDGET);

    expect(held.lines).toEqual([
      'Unit specs: the slowest took 812 ms (src/contexts/billing/test/unit/invoice.aggregate.spec.ts), budget 5000 ms.',
      'Integration specs: the slowest took 4200 ms (src/contexts/billing/test/integration/invoice.repository.contract.spec.ts), budget 30000 ms.',
    ]);

    expect(held.failure).toBeUndefined();

    const warned = budgetLines(overBudget([UNIT, SLOW_UNIT], REFERENCE_BUDGET), REFERENCE_BUDGET);

    expect(warned.failure).toBeUndefined();
    expect(warned.lines.at(-1)).toMatch(/^Warning: 1 spec file over the time budget: .*money\.vo\.spec\.ts \(6120 ms/);
    expect(warned.lines.at(-1)).toContain('set "enforce": true under "budget"');

    const over = budgetLines(overBudget([UNIT, SLOW_UNIT], REFERENCE_BUDGET), REFERENCE_BUDGET, true);

    expect(over.failure).toContain(
      '1 spec file over the time budget: src/contexts/billing/test/unit/money.vo.spec.ts (6120 ms, unit budget 5000 ms).',
    );

    expect(over.failure).toContain('"what": "budget.<level>"');
  });

  it('fails an enforced Vitest run from its reporter when the tests and hooks of a module took more than its budget, its collection left out', () => {
    const root = projectWith({ budget: { unit: 1000, enforce: true } });
    const reporter = new VitestDurationBudgetReporter({ root });
    const logged: string[] = [];

    reporter.onInit({ logger: { log: (message) => logged.push(message) } });

    const modules = [
      { moduleId: path.join(root, UNIT.file), diagnostic: () => ({ duration: 800 }) },
      {
        moduleId: path.join(root, 'test/e2e/issue-invoice.e2e.spec.ts'),
        diagnostic: () => ({ duration: 9000 }),
      },
    ];

    expect(() => reporter.onTestRunEnd(modules)).not.toThrow();
    expect(logged).toEqual([`Unit specs: the slowest took 800 ms (${UNIT.file}), budget 1000 ms.`]);

    expect(() =>
      reporter.onTestRunEnd([{ moduleId: path.join(root, SLOW_UNIT.file), diagnostic: () => ({ duration: 1150 }) }]),
    ).toThrow(
      /1 spec file over the time budget: src\/contexts\/billing\/test\/unit\/money\.vo\.spec\.ts \(1150 ms, unit budget 1000 ms\)/,
    );
  });

  it('warns from the Vitest reporter without failing the run while the budget is not enforced', () => {
    const root = projectWith({ budget: { unit: 1000 } });
    const reporter = new VitestDurationBudgetReporter({ root });
    const logged: string[] = [];

    reporter.onInit({ logger: { log: (message) => logged.push(message) } });

    expect(() =>
      reporter.onTestRunEnd([{ moduleId: path.join(root, SLOW_UNIT.file), diagnostic: () => ({ duration: 1150 }) }]),
    ).not.toThrow();

    expect(logged.at(-1)).toMatch(/^Warning: 1 spec file over the time budget/);
  });

  it('fails an enforced Jest run through the error its reporter keeps for the end', () => {
    const root = projectWith({ budget: { enforce: true } });
    const reporter = new JestDurationBudgetReporter(undefined, { root });

    reporter.onRunComplete(undefined, {
      testResults: [
        { testFilePath: path.join(root, INTEGRATION.file), testResults: [{ duration: 4000 }, { duration: 200 }] },
      ],
    });

    expect(reporter.getLastError()).toBeUndefined();

    reporter.onRunComplete(undefined, {
      testResults: [
        {
          testFilePath: path.join(root, SLOW_UNIT.file),
          testResults: [{ duration: 6000 }, { duration: 120 }, { duration: null }, {}],
        },
      ],
    });

    expect(reporter.getLastError()?.message).toContain('money.vo.spec.ts (6120 ms, unit budget 5000 ms)');
  });
});

describe('the time budget of the specs, read outside the contexts', () => {
  it('counts nothing a reporter is handed outside the levels held, and logs to the console before Vitest starts it', () => {
    const root = projectWith({});
    const vitest = new VitestDurationBudgetReporter({ root });
    const jest = new JestDurationBudgetReporter(undefined, { root });

    expect(() =>
      vitest.onTestRunEnd([
        { moduleId: path.join(root, 'test/e2e/issue-invoice.e2e.spec.ts'), diagnostic: () => ({ duration: 90_000 }) },
      ]),
    ).not.toThrow();

    jest.onRunComplete(undefined, {
      testResults: [
        { testFilePath: path.join(root, 'test/architecture/extractable.spec.ts'), testResults: [{ duration: 90_000 }] },
      ],
    });

    expect(jest.getLastError()).toBeUndefined();
    expect(new VitestDurationBudgetReporter().constructor.name).toBe('VitestDurationBudgetReporter');
    expect(new JestDurationBudgetReporter().getLastError()).toBeUndefined();
  });
});

describe('the time budget of the specs, in its corner cases', () => {
  it('keeps the slowest of a level whatever the order, names every spec over its budget, and reads a config that is no object as the reference', () => {
    const reading = overBudget([SLOW_UNIT, UNIT], REFERENCE_BUDGET);

    const twice = budgetLines(
      overBudget(
        [SLOW_UNIT, { ...SLOW_UNIT, file: 'src/contexts/billing/test/unit/tax.vo.spec.ts' }],
        REFERENCE_BUDGET,
      ),
      REFERENCE_BUDGET,
      true,
    );

    const root = mkdtempSync(path.join(workspace, 'project-'));

    writeFileSync(path.join(root, 'ddd-ts-kit.config.json'), '[]');

    expect(reading.slowest.unit).toEqual(SLOW_UNIT);
    expect(twice.failure).toMatch(/^2 spec files over the time budget/);
    expect(budgetSettings(root)).toEqual({ budget: REFERENCE_BUDGET, enforced: false });
  });

  it('logs its lines to the console when Vitest did not hand it a logger', () => {
    const root = projectWith({});
    const reporter = new VitestDurationBudgetReporter({ root });

    expect(() =>
      reporter.onTestRunEnd([{ moduleId: path.join(root, UNIT.file), diagnostic: () => ({ duration: 10 }) }]),
    ).not.toThrow();
  });
});
