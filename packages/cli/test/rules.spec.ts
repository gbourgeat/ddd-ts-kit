import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEVERITIES } from '../src/check/catalogue/default-severities.js';
import { ESLINT_ONLY_RULES } from '../src/check/catalogue/eslint-only-rules.js';
import { KNOWN_RULE_IDS } from '../src/check/catalogue/known-rule-ids.js';
import { RULE_IDS } from '../src/check/catalogue/rule-ids.js';
import { RULES } from '../src/check/catalogue/rules.js';
import { RULE_DOCS } from '../src/check/explain/rule-docs.js';
import { FIXTURES } from '../src/check/fixtures/fixtures.js';
import { runFixture } from '../src/check/fixtures/run-fixture.js';
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
        expect(violation?.severity).toBe(fixture.severity ?? DEFAULT_SEVERITIES[fixture.ruleId] ?? 'error');
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

  it('keeps one module per rule, named after its id', () => {
    const modules = fs.readdirSync(path.join(REPO_ROOT, 'packages/cli/src/check/rules'));

    expect(modules.map((file) => file.replace('.ts', '')).sort()).toEqual(RULES.map((rule) => rule.id.replace('/', '-')).sort());
  });

  it('shows no token constant, token file nor useClass outside the examples of what is refused', () => {
    const oldStyle = /\btoken\(|\buseClass\b|\.ports\.ts|platform\/tokens|interface \w+Repository\b|\[[A-Z][A-Z0-9]*_[A-Z0-9_]+[,\]]/;
    const refusing = ['ports/no-token-constant', 'ports/abstract-class'];
    const shown = Object.entries(RULE_DOCS).flatMap(([id, doc]) => (refusing.includes(id) ? [doc.good] : [doc.why, doc.bad, doc.good]));
    const written = FIXTURES.filter((fixture) => !refusing.includes(fixture.ruleId)).flatMap((fixture) => Object.values(fixture.files));

    expect([...shown, ...written].filter((text) => oldStyle.test(text))).toEqual([]);
  });
});
