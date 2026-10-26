import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { read, scaffoldEverything, tempDir } from '../helpers';
import { installAsPublished } from './install-as-published';
import { DEEP } from './night-stacks';
import { bin, findingsOf, runIn } from './run-in';
import { FIRST_CLASS, PROVEN, SLOW } from './stacks';

/** The only spec that runs the value object: without it the domain of billing falls under its floor. */
const REMOVED_SPEC = 'src/contexts/billing/test/unit/money.vo.spec.ts';

const UNMET =
  /Coverage for \w+ \([\d.]+%\) does not meet "src\/contexts\/billing\/domain\/\*\*\/\*\.ts" threshold \(\d+%\)/;

const EVERY_HELD = [...PROVEN, ['the stack of the example: class-validator, legacy decorators', FIRST_CLASS] as const];

/** Every proven stack and the stack of the example at night and before a release; the first of them on every other run. */
const HELD = DEEP ? EVERY_HELD : EVERY_HELD.slice(0, 1);

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): the coverage gate of a generated project, as its scripts run it.
 * As generated, every layer of every context reaches the thresholds of the reference, in the run
 * `verify` makes and in the two runs the pipeline splits it into; one spec less and the gate
 * fails, naming the context and the layer.
 */
describe.runIf(SLOW).each(HELD)('the coverage gate of a freshly generated project (%s)', (_label, stack) => {
  let root: string;

  const script = (name: string): string[] => {
    const { scripts } = JSON.parse(read(root, 'package.json')) as { scripts: Record<string, string> };

    return (scripts[name] ?? '').replace(/^vitest /, '').split(' ');
  };

  beforeAll(() => {
    root = tempDir('coverage');
    scaffoldEverything(root, stack);
    installAsPublished(root);
  }, 120_000);

  it('passes as generated: the run of verify, then the unit and the integration runs of the pipeline', () => {
    for (const name of ['test:coverage', 'ci:test:unit', 'ci:test:integration']) {
      const run = runIn(root, { command: bin('vitest'), args: script(name) });

      expect(run, name).toContain('Coverage report from v8');
      expect(run, name).not.toContain('does not meet');
    }
  }, 240_000);

  it('fails once a spec is removed, with a message that names the context and the layer left under their threshold', () => {
    fs.rmSync(path.join(root, REMOVED_SPEC));

    expect(findingsOf(root, { command: bin('vitest'), args: script('test:coverage') })).toMatch(UNMET);
  }, 240_000);
});
