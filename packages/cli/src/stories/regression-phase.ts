import type { Workspace } from '../workspace';
import { regressionSpecsIn } from './regression-specs-in';
import type { StoryPhase } from './story-phase';

/**
 * The regression specs of a fix story, in place of its acceptance: listed under `## Regression` of
 * its file, one path each, every one present in the tree. Whether they fail before the fix and
 * pass after it is what the tests say; the lock of the section is read by `acceptance <code>`.
 */
export function regressionPhase(ws: Workspace, story: string, specification: string | undefined): StoryPhase {
  const specs = specification === undefined ? undefined : regressionSpecsIn(ws.read(specification) ?? '');
  const missing = (specs ?? []).filter((spec) => ws.read(spec) === undefined);
  const [absent] = missing;

  return {
    id: 'acceptance',
    title: 'regression specs listed',
    met: specs !== undefined && specs.length > 0 && missing.length === 0,
    detail:
      specs === undefined
        ? 'no `## Regression` in the specification'
        : absent !== undefined
          ? `\`## Regression\` lists ${absent}, which does not exist`
          : `\`## Regression\` lists ${specs.length} spec${specs.length === 1 ? '' : 's'}`,
    next: `List the regression specs of ${story} under \`## Regression\` of docs/architecture/stories/${story}.md, one \`- test/<path>.spec.ts\` per line, each written to fail before the fix (skill ddd-ts-kit:fix), then \`npx ddd-ts-kit acceptance ${story} --lock\`.`,
    gate: 'build',
  };
}
