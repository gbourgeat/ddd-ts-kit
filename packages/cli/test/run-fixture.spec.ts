import { describe, expect, it } from 'vitest';
import type { Fixture } from '../src/check/fixtures/fixture';
import type { Rule } from '../src/check/model/rule';
import { FIXTURES } from '../src/check/fixtures/fixtures';
import { runFixture } from '../src/check/fixtures/run-fixture';

function fixtureNamed(name: string): Fixture {
  const found = FIXTURES.find((fixture) => fixture.name === name);

  if (found === undefined) {
    throw new Error(`no fixture is named "${name}"`);
  }

  return found;
}

const PASSING = fixtureNamed('private members, a hash in a string and in a comment');
const FAILING = fixtureNamed('a hash field and a hash method');

describe('a rule fixture that does not behave as it says', () => {
  it('names the violations when it expects none', () => {
    const outcome = runFixture({ ...FAILING, expect: 'pass' });

    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toMatch(/^expected no violation, got clean\/no-hash-private at src\/.+:\d+/);
  });

  it('says nothing was found when it expects a violation the rule does not report', () => {
    const outcome = runFixture({ ...PASSING, expect: { file: 'src/elsewhere.ts' } });

    expect(outcome).toMatchObject({
      ok: false,
      detail: 'expected clean/no-hash-private at src/elsewhere.ts, got nothing',
    });
  });

  it('lists what was reported instead of the violation it expects', () => {
    const outcome = runFixture({ ...FAILING, ruleId: 'clean/blank-lines' });

    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toMatch(/^expected clean\/blank-lines at .+, got clean\/no-hash-private at /);
  });

  it('names the other rules that fired when it does not allow them', () => {
    const allowing = FIXTURES.find((fixture) => fixture.also !== undefined && fixture.expect !== 'pass');

    expect(allowing).toBeDefined();

    const outcome = runFixture({ ...(allowing ?? FAILING), also: [] });

    expect(outcome.ok).toBe(false);
    expect(outcome.detail).toMatch(/^other rules fired: /);
  });

  it('says which violation it found when it behaves', () => {
    expect(runFixture(PASSING)).toMatchObject({ ok: true, detail: 'no violation' });
    expect(runFixture(FAILING).detail).toMatch(/^clean\/no-hash-private at .+:\d+$/);
  });
});

/** A rule of a spec, not of the kit: it reports every source and says nothing of what to do. */
const WITHOUT_FIX: Rule = {
  id: 'spec/without-fix',
  description: 'Reports every source without a fix.',
  scope: 'file',
  run(project) {
    return project.files.map(({ path }) => ({
      ruleId: this.id,
      severity: 'error',
      file: path,
      line: 1,
      message: 'Reported without a fix.',
      fix: '',
    }));
  },
};

describe('a rule fixture of a rule that writes no fix', () => {
  it('is refused: a violation says what to do', () => {
    const fixture: Fixture = {
      ruleId: WITHOUT_FIX.id,
      name: 'a source the rule reports',
      files: { 'ddd-ts-kit.config.json': '{ "contexts": {} }\n', 'src/invoice.ts': 'export const invoice = 1;\n' },
      expect: { file: 'src/invoice.ts' },
    };

    expect(runFixture(fixture, { catalogue: [WITHOUT_FIX] })).toMatchObject({
      ok: false,
      detail: 'the violation carries no fix',
    });
  });
});
