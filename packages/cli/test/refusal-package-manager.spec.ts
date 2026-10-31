import { describe, expect, it } from 'vitest';
import { cli, tempDir } from './helpers';

function project(...flags: string[]): string {
  const root = tempDir('other-orm');

  cli(root, 'init', ...flags);

  return root;
}

describe('the fix of a refusal speaks the package manager of the project', () => {
  it('says pnpm on a pnpm project and npm on an npm one', () => {
    const pnpm = cli(project(), 'drizzle-generate', '--name', 'x');
    const npm = cli(project('--package-manager', 'npm'), 'drizzle-generate', '--name', 'x');

    expect(pnpm.stderr).toContain('fix: Run `pnpm install` in the project first.');
    expect(npm.stderr).toContain('fix: Run `npm install` in the project first.');
  });

  it('says it in the JSON of --json too', () => {
    const result = cli(project(), 'lint', '--json');

    expect(JSON.stringify(result.json())).toContain('pnpm install --frozen-lockfile');
  });
});
