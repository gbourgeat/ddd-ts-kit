import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { read } from '../helpers';
import { bin, findingsOf, runIn } from './run-in';

/** The only spec that runs the value object: without it the domain of billing falls under its floor. */
const REMOVED_SPEC = 'src/contexts/billing/test/unit/money.vo.spec.ts';

const UNMET =
  /Coverage for \w+ \([\d.]+%\) does not meet "src\/contexts\/billing\/domain\/\*\*\/\*\.ts" threshold \(\d+%\)/;

/** The arguments of the vitest command a script of the project runs. */
export function scriptOf(root: string, name: string): string[] {
  const { scripts } = JSON.parse(read(root, 'package.json')) as { scripts: Record<string, string> };

  return (scripts[name] ?? '').replace(/^vitest /, '').split(' ');
}

/** The run `verify` makes: every spec once, every layer of every context held to the thresholds of the reference. */
export function runWithCoverage(root: string): string {
  const run = runIn(root, { command: bin('vitest'), args: scriptOf(root, 'test:coverage') });

  expect(run, 'test:coverage').toContain('Coverage report from v8');
  expect(run, 'test:coverage').not.toContain('does not meet');

  return run;
}

/** The two runs the pipeline splits the specs into, each as held to the thresholds as the run of `verify`. */
export function pipelineRunsHoldTheThresholds(root: string): void {
  for (const name of ['ci:test:unit', 'ci:test:integration']) {
    const run = runIn(root, { command: bin('vitest'), args: scriptOf(root, name) });

    expect(run, name).toContain('Coverage report from v8');
    expect(run, name).not.toContain('does not meet');
  }
}

/** One spec less and the gate fails, naming the context and the layer. Removes a file of the project: run it last. */
export function failsWithoutASpec(root: string): void {
  fs.rmSync(path.join(root, REMOVED_SPEC));

  expect(findingsOf(root, { command: bin('vitest'), args: scriptOf(root, 'test:coverage') })).toMatch(UNMET);
}
