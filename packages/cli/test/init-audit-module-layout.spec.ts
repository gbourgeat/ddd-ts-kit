import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { exists, read, REPO_ROOT } from './helpers';
import { initProject } from './support/init-project';

const MODULE = 'src/platform/audit/audit.module.ts';
const COMPOSITION = 'src/platform/composition/compose-application.ts';

/** What the formatter of the kit reports on these files of a project, empty when it has nothing to change. */
function formatFindings(root: string, paths: readonly string[]): string {
  try {
    execFileSync(path.join(REPO_ROOT, 'node_modules/.bin/biome'), ['format', ...paths], { cwd: root, stdio: 'pipe' });

    return '';
  } catch (error) {
    return error instanceof Error && 'stdout' in error && 'stderr' in error
      ? `${String(error.stdout)}${String(error.stderr)}`
      : String(error);
  }
}

describe('init: the audit module of a trail without a database', () => {
  it.each([
    [['--orm', 'none', '--audit', 'on']],
    [['--orm', 'custom', '--audit', 'on']],
    [['--orm', 'none', '--audit', 'on', '--di', 'manual']],
  ])('closes its blocks without a blank line, as the formatter writes them (%j)', (flags) => {
    const root = initProject(...flags);
    const files = [MODULE, COMPOSITION].filter((file) => exists(root, file));

    for (const file of files) {
      expect(read(root, file), file).not.toMatch(/\n\n\s*\}/);
    }

    expect(formatFindings(root, files)).toBe('');
  });
});
