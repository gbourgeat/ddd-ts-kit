import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { KNOWN_RULE_IDS } from '../../src/check/catalogue/known-rule-ids.js';
import { REPO_ROOT } from '../helpers.js';
import { CONFORMANCE } from './conformance-enabled.js';
import { DELEGATED_PROOFS } from './delegated-proofs.js';
import { ExampleCopy } from './example-copy.js';
import { expectOnly } from './expect-only.js';
import type { Finding } from './finding.js';
import { INJECTIONS } from './injections.js';
import { lintInRounds } from './lint-in-rounds.js';
import { NOT_APPLICABLE } from './not-applicable.js';

const started = Date.now();

/**
 * Slow, opt-in (DDD_TS_KIT_CONFORMANCE=1): the example application is the proof of the product.
 * Every rule of the catalogue is broken once in a copy of the example and has to be reported, on
 * the file that breaks it, by every analyzer that holds it; the untouched copy has nothing to report.
 */
describe.runIf(CONFORMANCE)('the rules of the catalogue, applied to the example application', () => {
  let copy: ExampleCopy;

  let linted: Map<string, Finding[]>;

  beforeAll(() => {
    copy = ExampleCopy.create();
    linted = lintInRounds(copy, INJECTIONS);
  }, 240_000);

  afterEach(() => {
    copy.restore();
  });

  it('the catalogue is the table of docs/ARCHITECTURE.md section 3, id for id', () => {
    const architecture = fs.readFileSync(path.join(REPO_ROOT, 'docs/ARCHITECTURE.md'), 'utf8');
    const section = architecture.slice(architecture.indexOf('## 3.'), architecture.indexOf('## 4.'));
    const documented = [...section.matchAll(/^\| `([a-z-]+\/[a-z-]+)` \|/gm)].map((match) => match[1]);

    expect([...documented].sort()).toEqual([...KNOWN_RULE_IDS].sort());
  });

  it('every rule of the catalogue has one injection, or a stated reason not to apply to the example', () => {
    const injected = INJECTIONS.map((injection) => injection.rule);
    const excused = Object.keys(NOT_APPLICABLE);
    const table = Object.entries(NOT_APPLICABLE).map(([rule, reason]) => `  ${rule}: ${reason}`);

    console.info(
      `conformance: ${KNOWN_RULE_IDS.length} rule ids, ${injected.length} injections, ${excused.length} not applicable\n${table.join('\n')}`,
    );

    expect(KNOWN_RULE_IDS.filter((id) => !injected.includes(id) && !excused.includes(id))).toEqual([]);
    expect([...injected, ...excused].filter((id) => !KNOWN_RULE_IDS.includes(id))).toEqual([]);
    expect(injected.filter((id, index) => injected.indexOf(id) !== index || excused.includes(id))).toEqual([]);
    expect(Object.values(NOT_APPLICABLE).filter((reason) => reason.trim().length < 40)).toEqual([]);
  });

  it('the untouched copy has nothing to report: checker, ESLint, formatter, import graph, dead code, types', () => {
    expect(copy.checked()).toEqual([]);
    expect(copy.linted()).toEqual([]);
    expect(copy.formatted('.')).toMatchObject({ code: 0 });
    expect(copy.graph()).toMatchObject({ code: 0 });
    expect(copy.deadCode()).toMatchObject({ code: 0, stdout: '' });
    expect(copy.typeChecked()).toMatchObject({ code: 0, stdout: '' });
  }, 240_000);

  it.each(INJECTIONS)(
    '$rule: $what',
    (injection) => {
      copy.apply(injection);

      expectOnly('checker', copy.checked(), injection);
      expectOnly('eslint', linted.get(injection.rule) ?? [], injection);

      if (injection.formatter === true) {
        expect(copy.formatted(injection.file)).toMatchObject({ code: 1 });
      }
    },
    60_000,
  );

  it.each(DELEGATED_PROOFS)(
    '$what',
    ({ tool, changes, prints }) => {
      copy.apply({ changes });

      const { code, stdout, stderr } = copy[tool]();

      expect(code).not.toBe(0);

      for (const printed of prints) {
        expect(`${stdout}\n${stderr}`).toContain(printed);
      }
    },
    60_000,
  );

  it('reports its runtime', () => {
    console.info(`conformance: ${((Date.now() - started) / 1000).toFixed(1)} s`);
  });
});
