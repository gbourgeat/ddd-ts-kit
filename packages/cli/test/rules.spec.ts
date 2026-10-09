import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULE_DOCS } from '../src/check/explain.js';
import { FIXTURES, runFixture } from '../src/check/fixtures.js';
import { ESLINT_ONLY_RULES, KNOWN_RULE_IDS, RULE_IDS, RULES } from '../src/check/rules/index.js';
import { DEFAULT_SEVERITIES } from '../src/check/severity.js';
import { REPO_ROOT } from './helpers.js';

describe('rule fixtures', () => {
  for (const fixture of FIXTURES) {
    const expected = fixture.expect === 'pass' ? 'passes' : `fails at ${fixture.expect.file}`;
    it(`${fixture.ruleId} ${expected}: ${fixture.name}`, () => {
      const outcome = runFixture(fixture);

      expect(outcome.detail).toSatisfy(() => outcome.ok);
      if (fixture.expect !== 'pass') {
        const { file } = fixture.expect;
        const violation = outcome.violations.find((candidate) => candidate.ruleId === fixture.ruleId && candidate.file === file);
        expect(violation?.fix.length).toBeGreaterThan(20);
        expect(violation?.line).toBeGreaterThan(0);
        expect(violation?.severity).toBe(DEFAULT_SEVERITIES[fixture.ruleId] ?? 'error');
      }
    });
  }
});

describe('rule catalogue', () => {
  it('implements every rule id of docs/ARCHITECTURE.md section 3', () => {
    const architecture = fs.readFileSync(path.join(REPO_ROOT, 'docs/ARCHITECTURE.md'), 'utf8');
    const section = architecture.slice(architecture.indexOf('## 3.'), architecture.indexOf('## 4.'));
    const documented = [...section.matchAll(/^\| `([a-z-]+\/[a-z-]+)` \|/gm)].map((match) => match[1]);

    expect(documented.length).toBeGreaterThanOrEqual(18);
    expect(KNOWN_RULE_IDS).toEqual(expect.arrayContaining(documented));
    expect(ESLINT_ONLY_RULES.map((rule) => rule.id).filter((id) => !documented.includes(id))).toEqual([]);
  });

  it('has one passing and one failing fixture per rule', () => {
    for (const id of RULE_IDS) {
      const own = FIXTURES.filter((fixture) => fixture.ruleId === id);
      expect(own.some((fixture) => fixture.expect === 'pass'), `${id} passing fixture`).toBe(true);
      expect(own.some((fixture) => fixture.expect !== 'pass'), `${id} failing fixture`).toBe(true);
    }
  });

  it('explains every rule with a reason and both examples', () => {
    for (const id of RULE_IDS) {
      const doc = RULE_DOCS[id];
      expect(doc?.why.split('. ').length, id).toBeGreaterThanOrEqual(2);
      expect(doc?.bad, id).toBeTruthy();
      expect(doc?.good, id).toBeTruthy();
    }
  });

  it('keeps one module per rule', () => {
    const modules = fs.readdirSync(path.join(REPO_ROOT, 'packages/cli/src/check/rules')).filter((file) => !['index.ts', 'helpers.ts'].includes(file));

    expect(modules.map((file) => file.replace('.ts', '').replace('-', '/')).sort()).toEqual(RULES.map((rule) => rule.id).sort());
  });
});
