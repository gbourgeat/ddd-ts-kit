import { describe, expect, it } from 'vitest';
import { runFixture } from '../src/check/fixtures/run-fixture';
import { SHARED_FOLDER_FIXTURES } from '../src/check/fixtures/shared-folder-fixtures';
import { projectWith, reported } from './rules-support';

const SCHEDULING = 'src/contexts/scheduling';

/** What the rule of a fixture of the layout to come says, by the name of the fixture. */
function said(name: string): { message: string; fix: string }[] {
  return SHARED_FOLDER_FIXTURES.filter((fixture) => fixture.name === name).flatMap((fixture) =>
    runFixture(fixture)
      .violations.filter((violation) => violation.ruleId === fixture.ruleId)
      .map(({ message, fix }) => ({ message, fix })),
  );
}

describe('the test rules, on a module that holds its tests', () => {
  it('names the test folder of the module where the spec is missing', () => {
    const [finding] = said('an aggregate of a module that holds its tests, without a spec');

    expect(finding?.message).toBe('invoice.aggregate.ts has no spec in src/contexts/billing/invoices/test/.');
    expect(finding?.fix).toContain('Create src/contexts/billing/invoices/test/unit/invoice.aggregate.spec.ts');
  });

  it('names the builders of the module where the builder is missing', () => {
    const [finding] = said('an aggregate of a module that holds its tests, without a builder');

    expect(finding?.message).toBe(
      'The aggregate invoice.aggregate.ts has no builder in src/contexts/billing/invoices/test/builders/.',
    );

    expect(finding?.fix).toContain('Create src/contexts/billing/invoices/test/builders/invoice.builder.ts');
  });

  it('names the test folder of a module that holds no test yet', () => {
    const root = projectWith(
      { [`${SCHEDULING}/calendars/domain/aggregates/calendar.aggregate.ts`]: 'export class Calendar {}\n' },
      { contexts: { scheduling: { classification: 'core', modules: { calendars: {} } } } },
    );

    expect(reported(root, 'test/spec-required').map(({ message }) => message)).toEqual([
      `calendar.aggregate.ts has no spec in ${SCHEDULING}/calendars/test/.`,
    ]);

    expect(reported(root, 'test/builder-required').map(({ message }) => message)).toEqual([
      `The aggregate calendar.aggregate.ts has no builder in ${SCHEDULING}/calendars/test/builders/.`,
    ]);
  });
});

describe('module/complete, on a file of a module left in shared', () => {
  it('names the folder of shared where the file is, and the path to give move-to-module', () => {
    const [finding] = said('an adapter of a module left in shared/, named where it is');

    expect(finding?.message).toBe(
      'shared/infrastructure/persistence of "billing" holds 1 file(s) outside every module of its model: knex-invoice.repository.ts.',
    );

    expect(finding?.fix).toContain('shared/infrastructure/persistence/<file or use case>');
  });
});
