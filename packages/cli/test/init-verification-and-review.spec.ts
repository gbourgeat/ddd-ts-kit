import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers.js';
import { initProject } from './support/init-project.js';
import { NPM } from './support/npm.js';

describe('the verification section of the guide', () => {
  it('gives each command with the lines it prints when it passes, as the project prints them, and the rule that a failing check is fixed in the code', () => {
    const guide = read(initProject(...NPM), 'AGENTS.md');
    const [, section = ''] = guide.split('## Verifying your work\n');
    const [verifying = ''] = section.split('\n## ');

    expect(verifying).toContain('`npm run verify` prints no line of its own and exits 0 once every gate passed');
    expect(verifying).toContain('`The generated documentation is up to date.`');
    expect(verifying).toContain('`npm run typecheck`, `npm run lint` and `npm run deadcode` print nothing and exit 0.');
    expect(verifying).toContain('`Checked N files in <time>. No fixes applied.`');
    expect(verifying).toContain('`npm run test:coverage`: `Test Files N passed (N)` and `Tests N passed (N)`');
    expect(verifying).toContain('`0 errors, 0 warnings, 0 suppressions in N files.`');
    expect(verifying).toContain('`no dependency violations found (N modules, M dependencies cruised)`');

    expect(verifying).toContain(
      '`npm run test:e2e`: `Test Files N passed (N)` (before the first spec, `No test files found, exiting with code 0`)',
    );

    expect(verifying).toContain('`npx ddd-ts-kit acceptance <story> --gate passing` ends with `gate passing: met`.');
    expect(verifying).toContain('A failing check is fixed in the code, never in the check, the threshold or the test.');
    expect(verifying).not.toContain('Test Suites:');
  });

  it('says the summary of jest under jest, and leaves the end-to-end commands out without an HTTP stack', () => {
    const jest = read(initProject(...NPM, '--tests', 'jest'), 'AGENTS.md');

    expect(jest).toContain('`npm run test:coverage`: `Test Suites: N passed, N total` and `Tests: N passed, N total`');
    expect(jest).toContain('`npm run test:e2e`: `Test Suites: N passed, N total`;');
    expect(jest).not.toContain('Test Files N passed');

    const headless = read(initProject(...NPM, '--http', 'none', '--orm', 'none'), 'AGENTS.md');

    expect(headless).not.toContain('test:e2e');
    expect(headless).not.toContain('--gate passing');
  });

  it('leaves the mistakes seen here to the team, under the rule of two', () => {
    const guide = read(initProject(...NPM), 'AGENTS.md');
    const [, section = ''] = guide.split('## Mistakes seen here\n');
    const [mistakes = ''] = section.split('\n## ');

    expect(mistakes).toContain('a review finding or a `TODO(review)` made twice becomes one line here');
    expect(mistakes).toContain('- none yet');
  });

  it('speaks the package manager of the project in the verification section', () => {
    expect(read(initProject('--package-manager', 'pnpm'), 'AGENTS.md')).toContain(
      '`pnpm run verify` prints no line of its own',
    );
  });
});

describe('the review policy init writes', () => {
  it('writes REVIEW.md once, with its passes, what Important means, the cap on nits and what is not reported, and leaves it to the team even with --force', () => {
    const root = initProject(...NPM);
    const policy = read(root, 'REVIEW.md');

    expect(policy).toContain('# Review instructions');
    expect(policy).toContain('## Passes');
    expect(policy).toContain('- Bugs:');
    expect(policy).toContain('- Security:');
    expect(policy).toContain('- Compliance:');
    expect(policy).toContain('npx ddd-ts-kit check --changed-since <base> --explain');
    expect(policy).toContain('## What Important means here');
    expect(policy).toContain('## Cap the nits');
    expect(policy).toContain('a line of `AGENTS.md` under `## Mistakes seen here`');
    expect(policy).toContain('## Do not report');
    expect(policy).toContain('`src/platform/http/openapi-documents.ts`');
    expect(policy).toContain('anything `npm run verify` already refuses');

    write(root, 'REVIEW.md', '# Ours\n');

    const forced = cli(root, 'init', ...NPM, '--force', '--json').json();

    expect(read(root, 'REVIEW.md')).toBe('# Ours\n');
    expect(forced).toMatchObject({ created: expect.not.arrayContaining(['REVIEW.md']) });
    expect(forced).toMatchObject({ updated: expect.not.arrayContaining(['REVIEW.md']) });
  });

  it('speaks the package manager of the project', () => {
    expect(read(initProject('--package-manager', 'pnpm'), 'REVIEW.md')).toContain(
      'anything `pnpm run verify` already refuses',
    );
  });
});
