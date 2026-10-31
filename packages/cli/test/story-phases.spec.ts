import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Slice } from '../src/progress/slice';
import { readStoryPhases } from '../src/stories/read-story-phases';
import { Workspace } from '../src/workspace';
import { tempDir, write } from './helpers';

const SPECIFICATION = 'docs/architecture/stories/US5.md';
const NO_ACCEPTANCE = '1 left: US5 has no acceptance spec';

function rowOf(id: string, status = 'todo'): Slice {
  return {
    id,
    context: 'ordering',
    kind: 'slice',
    slice: 'Place order',
    startWith: '',
    dependsOn: [],
    owner: 'ordering',
    status,
  };
}

/** Each phase of US5 as `[id, met, detail]`, in a project holding the given files. */
function phasesOf(files: Readonly<Record<string, string>>, rows: readonly Slice[]) {
  const root = tempDir('story-phases');

  for (const [file, text] of Object.entries(files)) {
    write(root, file, text);
  }

  return readStoryPhases(new Workspace(root, false), 'US5', rows).map(({ id, met, detail }) => [id, met, detail]);
}

describe('the phases of a story, read from its files', () => {
  it('says which file of the story is missing before anything is written, and counts one row in the singular', () => {
    expect(phasesOf({}, [rowOf('US5.01')])).toEqual(
      expect.arrayContaining([
        ['specification', false, `no ${SPECIFICATION}`],
        ['rows', true, '1 row in docs/architecture/slices.md'],
        ['design', false, 'no docs/architecture/reviews/US5.md'],
        ['acceptance', false, expect.stringContaining(NO_ACCEPTANCE)],
        ['built', false, '0 of 1 done, next #US5.01 Place order'],
        ['report', false, 'no `## Report` in the specification'],
      ]),
    );
  });

  it('takes a specification with a `## Regression` section for a fix: its rows and their design are optional', () => {
    const fix = '# US5\n\n## Regression\n\n- `test/unit/order.spec.ts`: refuses a second payment\n';

    expect(phasesOf({ [SPECIFICATION]: fix }, [])).toEqual([
      ['specification', true, `${SPECIFICATION}, 0 acceptance criteria, a fix`],
      ['rows', true, 'no row, optional for a fix'],
      ['design', true, 'no row to design, optional for a fix'],
      ['acceptance', false, '`## Regression` lists test/unit/order.spec.ts, which does not exist'],
      ['built', true, 'no row, optional for a fix: the fix is built in its commits'],
      ['trunk', true, 'read in the worktree of the story'],
      ['origin', false, 'no `## Origin` in the specification'],
      ['report', false, 'no `## Report` in the specification'],
    ]);
  });

  it('holds the close gate on its acceptance once every row is done', () => {
    const story = '# US5\n\n## Acceptance criteria\n\n- AC1: a customer places an order\n- AC2: a customer reads it\n';
    const phases = phasesOf({ [SPECIFICATION]: story }, [rowOf('US5.01', 'done'), rowOf('US5.02', 'done')]);

    expect(phases).toEqual(
      expect.arrayContaining([
        ['specification', true, `${SPECIFICATION}, 2 acceptance criteria`],
        ['rows', true, '2 rows in docs/architecture/slices.md'],
        ['built', true, '2 of 2 done'],
        ['passing', false, expect.stringContaining(NO_ACCEPTANCE)],
      ]),
    );
  });
});

describe('the phases of a story whose files hold only the template', () => {
  const template = readFileSync(path.resolve(__dirname, '../../../plugin/skills/story/story-template.md'), 'utf8');

  it('does not take the placeholders of the template for a written origin or a pasted verification', () => {
    const phases = phasesOf({ [SPECIFICATION]: template.replaceAll('<code>', 'US5') }, []);

    expect(phases).toEqual(
      expect.arrayContaining([
        ['origin', false, '`## Origin` has no written `From:` nor `Built with:` line'],
        ['report', false, 'written, without `### Verification` naming `npm run verify` and its result'],
      ]),
    );
  });
});
