import { describe, expect, it } from 'vitest';
import { exists, read, write } from './helpers';
import { git } from './support/git';
import { initProject } from './support/init-project';

const ENVIRONMENT_FILES = ['.env', '.env.local', '.env.production', '.env.development.local', '.env.test'];

describe('the files init keeps out of version control and out of the image', () => {
  it('ignores every environment file but the example, which is tracked', () => {
    const root = initProject();

    if (!exists(root, '.git')) {
      git(root, 'init', '-q');
    }

    for (const file of ENVIRONMENT_FILES) {
      write(root, file, 'SECRET=1\n');
    }

    expect(
      git(root, 'check-ignore', ...ENVIRONMENT_FILES)
        .trim()
        .split('\n'),
    ).toEqual(ENVIRONMENT_FILES);

    expect(() => git(root, 'check-ignore', '.env.example')).toThrow();
    expect(git(root, 'add', '--dry-run', '.env.example')).toBe("add '.env.example'\n");
  });

  it('leaves every environment file but the example out of the build context of the image', () => {
    const lines = read(initProject(), '.dockerignore').split('\n');

    expect(lines).toEqual(expect.arrayContaining(['.env', '.env.*', '!.env.example']));
    expect(lines.indexOf('!.env.example')).toBeGreaterThan(lines.indexOf('.env.*'));
  });
});
