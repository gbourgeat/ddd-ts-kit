import { describe, expect, it } from 'vitest';
import { cli, write } from './helpers';
import { initProject } from './support/init-project';

describe('check, a path it is asked about', () => {
  const root = initProject('--context', 'billing:core');

  it('refuses a path that exists nowhere instead of reporting it clean', () => {
    const missing = cli(root, 'check', 'src/contexts/billng');

    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('No such path: src/contexts/billng.');
    expect(missing.stderr).toContain('fix: Name a file or a folder');
    expect(cli(root, 'check', '--clean-only', 'nothere/').code).toBe(2);
  });

  it('refuses a folder that exists and holds no file the checker reads, though a project with nothing to report is clean', () => {
    write(root, 'notes/todo.md', 'nothing to check here\n');

    const empty = cli(root, 'check', 'notes');

    expect(empty.code).toBe(2);
    expect(empty.stderr).toContain('error: notes holds nothing to check.');
    expect(empty.stderr).toContain('TypeScript files (*.ts) under src/');

    // The two differ by what was asked: `check` alone reads the project and may find nothing to
    // report, a path asked for is a claim that something is there, and an empty answer would read as clean.
    const fresh = initProject();

    expect(cli(fresh, 'check').code).toBe(0);
    expect(cli(fresh, 'check', 'docs').code).toBe(2);
  });
});
