import { expect } from 'vitest';
import { cli } from '../helpers.js';
import { DEPCRUISE, ESLINT, KNIP, NEW_ESLINT_RULES } from './analyzers.js';
import { bin, findingsOf, runIn } from './run-in.js';

/** The checker, ESLint with the preset and the rules of this wave, dependency-cruiser with the generated configuration, knip: nothing to say. */
export function expectNoFinding(root: string): void {
  const linted = runIn(root, { command: bin('eslint'), args: ['--print-config', 'src/main.ts'] });

  expect(cli(root, 'check', '--json').json()).toMatchObject({ ok: true, errors: 0, warnings: 0, violations: [] });
  expect(cli(root, 'depcruise-config', '--check').code).toBe(0);
  expect(NEW_ESLINT_RULES.filter((rule) => !linted.includes(`"${rule}"`))).toEqual([]);
  expect(findingsOf(root, ESLINT)).toBe('');
  expect(findingsOf(root, DEPCRUISE)).toBe('');
  expect(findingsOf(root, KNIP)).toBe('');
}
