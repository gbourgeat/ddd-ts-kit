import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MeasuresView } from '../src/measures/measures-view.js';
import { cli, tempDir, write } from './helpers.js';
import { commitFiles } from './support/commit-files.js';
import { git } from './support/git.js';
import { measuredStories, STATEMENT_OF_US5 } from './support/measured-stories.js';

let root: string;

beforeAll(() => {
  root = measuredStories();
});

describe('ddd-ts-kit measures: the text', () => {
  it('prints one line per story, the medians and the shares, and the authors only when asked', () => {
    const text = cli(root, 'measures', '--format', 'text').stdout;

    expect(text).toContain('Measures of main: 2 stories, 1 closed (merged on this branch).');
    expect(text).toContain('  US5  opened 2026-03-01  design 1d  build 3d  lead 5d (merged ');

    expect(text).toContain(
      'rework 1 criteria change(s), 1 amendment(s), 0 refusal(s)  decisions 2  compromises 2  review 1 settled, 1 opened, repeats language/glossary-term; name the total after its term  verification yes  origin ticket  overlaps US6',
    );

    expect(text).toContain(
      '  US6  opened 2026-03-03  design open  build open  lead open  rework 0 criteria change(s), 0 amendment(s), 1 refusal(s)  decisions 0  compromises 0  review 0 settled, 0 opened, findings 2 bugs, 1 security, repeats',
    );

    expect(text).toContain('origin incident (repeats docs/architecture/incidents/inc-1.md)  overlaps US5');

    expect(text).toContain(
      'Medians: design 1d, build 3d, lead 5d over 1 closed; 0.5 criteria change(s), 1 decision(s), 1 compromise(s), 0.5 marker(s) settled per story.',
    );

    expect(text).toContain(
      'Verification: 1 of 2 report(s) name `npm run verify`. Origin: 2 of 2 name an intent, a ticket or an incident. Parallel: 2 built while another one was. Repeats across stories: 2 (language/glossary-term; name the total after its term). Repeat incidents: 1.',
    );

    expect(text).toContain('Not computed: time to first review');
    expect(text).not.toContain('By author');

    const authored = cli(root, 'measures', '--by-author', '--since', '2026-03-01').stdout;

    expect(authored).toContain('Measures of main since 2026-03-01: 2 stories');

    expect(authored).toContain(
      'By author (asked for with --by-author: a measure read per person changes what people do):',
    );

    expect(authored).toContain('  Test  2 stories, 1 closed, lead 5d');
    expect(authored).toContain('  by Test');
  });

  it('refuses a day that is not a date and a format it does not print', () => {
    const since = cli(root, 'measures', '--since', 'yesterday');
    const format = cli(root, 'measures', '--format', 'csv');

    expect(since.code).toBe(2);
    expect(since.stderr).toContain('--since yesterday is not a date.');
    expect(format.code).toBe(2);
    expect(format.stderr).toContain('--format csv is not an output of measures.');
  });
});

describe('ddd-ts-kit measures: without history', () => {
  it('reads the files alone outside a repository, and says when no story exists', () => {
    const bare = tempDir('measures-bare');

    write(bare, 'ddd-ts-kit.config.json', '{}\n');

    write(
      bare,
      'docs/architecture/stories/US9.md',
      `${STATEMENT_OF_US5}\n## Origin\n\nSee docs/architecture/intents/orders.md.\n`,
    );

    const outside = cli(bare, 'measures', '--json');
    const outsideView = outside.json() as MeasuresView;

    expect(outside.code).toBe(0);
    expect(outsideView.branch).toBe('none');
    expect(outsideView.stories[0]).toMatchObject({ story: 'US9', origin: 'intent', overlaps: [], decisions: 0 });
    expect(outsideView.stories[0]?.opened).toBeUndefined();
    expect(outsideView.summary.medianDesignHours).toBeUndefined();

    const text = cli(bare, 'measures', '--by-author').stdout;

    expect(text).toContain('Measures of none: 1 story, 0 closed');
    expect(text).toContain('  US9  not committed  design open  build open  lead open');
    expect(text).toContain('  unknown  1 story, 0 closed, lead open');

    expect(cli(bare, 'measures', '--since', '2026-01-01').stdout).toContain(
      'Measures of none since 2026-01-01: 0 stories',
    );

    fs.rmSync(path.join(bare, 'docs'), { recursive: true });

    expect(cli(bare, 'measures').stdout).toContain('No story file in docs/architecture/stories/ for this period.');

    expect(cli(bare, 'measures', '--since', '2026-01-01').stdout).toContain(
      'Measures of none since 2026-01-01: 0 stories',
    );
  });
});

describe('ddd-ts-kit measures: a story squash-merged, measured in hours', () => {
  it('reads a lead time from the commit whose subject names the branch, findings without a pass heading, and an incident repeated by its message', () => {
    const root = path.join(fs.realpathSync(tempDir('measures-hours')), 'shop');

    const at = (instant: string, message: string, files: Readonly<Record<string, string>>): string =>
      commitFiles(root, { message, files, at: instant });

    fs.mkdirSync(root);
    git(root, 'init', '--quiet', '--initial-branch', 'main');

    at('2026-04-01T08:00:00Z', 'chore: bootstrap', {
      'ddd-ts-kit.config.json': '{}\n',
      'docs/architecture/stories/US7.md': STATEMENT_OF_US5.replace('US5', 'US7'),
      'docs/architecture/stories/US8.md': `# US8\n\n## Origin\n\nIncident docs/architecture/incidents/new.md.\n\n## Report\n`,
      'docs/architecture/reviews/US7.md':
        '# US7\n\n## Findings\n\n- bugs: short\n- a plain item that no pass names here\n',
      'docs/architecture/incidents/old.md': '- message: Slot already taken\n- message: twice\n',
      'docs/architecture/incidents/new.md': '- **message**: `Slot already taken`\n- error_code: OTHER\n',
    });

    at('2026-04-01T13:00:00Z', 'test(acceptance): US7 locked\n\nSlice: US7.01', {
      'test/acceptance/us7.acceptance.lock.json': '{"story":"US7"}',
      'src/contexts/ordering/order.ts': '// TODO(review): #US7.01 fix it\n',
    });

    at('2026-04-02T15:00:00Z', 'docs(story): US7 report', {
      'docs/architecture/stories/US7.md': `${STATEMENT_OF_US5.replace('US5', 'US7')}\nDone.\n`,
    });

    at('2026-04-03T08:00:00Z', 'feat(ordering): order (story/US7 squashed)', { 'src/contexts/ordering/lines.ts': '' });

    const text = cli(root, 'measures').stdout;

    expect(text).toContain('  US7  opened 2026-04-01  design 5h  build 1d 2h  lead 2d (merged ');

    expect(text).toContain(
      'review 0 settled, 1 opened, findings 1 bugs, 1 unsorted  verification no  origin none  overlaps US8',
    );

    expect(text).toContain('origin incident (repeats docs/architecture/incidents/old.md)  overlaps US7');
    expect(text).toContain('Medians: design 5h, build 1d 2h, lead 2d over 1 closed;');
  });
});
