import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cli, exists } from './helpers';
import { committedProject } from './support/committed-project';
import { jsonAt } from './support/json-at';
import { NPM } from './support/npm';
import { type StubInstallers, stubInstallers } from './support/stub-installers';

let installers: StubInstallers;
let root: string;
let parent: string;

beforeAll(() => {
  installers = stubInstallers();
  root = committedProject('clinic', '--context', 'invoicing:core', '--context', 'calendars:supporting', ...NPM);
  parent = fs.realpathSync(path.dirname(root));
});

beforeEach(() => installers.failing(false));

afterAll(() => installers.restore());

/** The notes of `worker-scope` for one context, in the worktree `../<directory>`. */
function notesOf(context: string, directory: string, ...flags: string[]): string[] {
  const scope = cli(root, 'worker-scope', context, '--worktree', `../${directory}`, ...flags, '--json');

  expect(scope.code).toBe(0);

  const notes = jsonAt(scope.json(), 'notes');

  return Array.isArray(notes) ? notes.map(String) : [];
}

describe('worker-scope, on the dependencies of the worktree', () => {
  it('runs npm ci in a worktree it creates for a project on npm', () => {
    const notes = notesOf('invoicing', 'clinic-invoicing');

    expect(installers.calls()).toEqual([`npm ci in ${path.join(parent, 'clinic-invoicing')}`]);
    expect(notes).toContainEqual(expect.stringMatching(/^dependencies installed in the worktree with `npm ci` \(/));
    expect(notes.join('\n')).not.toContain('Install the dependencies');
  });

  it('installs nothing in a worktree it keeps, nor with --dry-run', () => {
    const before = installers.calls().length;

    notesOf('invoicing', 'clinic-invoicing');
    notesOf('calendars', 'clinic-calendars', '--dry-run');

    expect(installers.calls()).toHaveLength(before);
    expect(exists(parent, 'clinic-calendars')).toBe(false);
  });

  it('says what to run when the install fails, with the end of what it printed', () => {
    installers.failing(true);

    const notes = notesOf('calendars', 'clinic-calendars');
    const failed = notes.find((note) => note.startsWith('`npm ci` failed in the worktree ('));
    const worktree = path.join(parent, 'clinic-calendars');

    expect(failed).toContain(
      `s). Install the dependencies in the worktree before the worker starts: \`cd ${worktree} && npm ci\`.\n`,
    );

    expect(failed).toContain('\n  npm error The lockfile is missing');
  });

  it('leaves the install to the conductor with --no-install, and says what to run', () => {
    const before = installers.calls().length;
    const notes = notesOf('calendars', 'clinic-calendars-2', '--branch', 'build/calendars-2', '--no-install');

    expect(installers.calls()).toHaveLength(before);

    expect(notes).toContain(
      `Install the dependencies in the worktree before the worker starts: \`cd ${path.join(parent, 'clinic-calendars-2')} && npm ci\`.`,
    );
  });
});
