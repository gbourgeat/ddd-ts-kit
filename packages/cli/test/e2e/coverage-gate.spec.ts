import { beforeAll, describe, it } from 'vitest';
import { scaffoldEverything, tempDir } from '../helpers';
import { failsWithoutASpec, pipelineRunsHoldTheThresholds, runWithCoverage } from './coverage-gate';
import { installAsPublished } from './install-as-published';
import { DEEP } from './night-stacks';
import { FIRST_CLASS, SLOW } from './stacks';

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1), at night and before a release (`DEEP`): the coverage gate of the stack of the
 * example, class-validator and the legacy decorators it imposes. The proven stacks are held to it in
 * `proven-stacks.spec.ts`, in the project the rest of their gate uses.
 */
describe.runIf(SLOW && DEEP)('the coverage gate of a freshly generated project (the stack of the example)', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('coverage');
    scaffoldEverything(root, FIRST_CLASS);
    installAsPublished(root);
  }, 120_000);

  it('passes as generated: the run of verify, then the unit and the integration runs of the pipeline', () => {
    runWithCoverage(root);
    pipelineRunsHoldTheThresholds(root);
  }, 240_000);

  it('fails once a spec is removed, with a message that names the context and the layer left under their threshold', () => {
    failsWithoutASpec(root);
  }, 240_000);
});
