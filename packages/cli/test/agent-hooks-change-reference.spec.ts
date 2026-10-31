import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempDir, write } from './helpers';
import { git } from './support/git';
import { initProject } from './support/init-project';
import { NPM } from './support/npm';
import { readJson } from './support/read-json';
import { edit, REFERENCE, runHook, SETTINGS } from './support/regulated-hooks';

describe('the change reference of the regulated profile', () => {
  const root = initProject(...NPM, '--agent-profile', 'regulated');

  it('is registered on the Edit and Write tools, and asks for a change reference on a migration or the containers, without blocking', () => {
    expect(readJson(root, SETTINGS)).toMatchObject({
      hooks: {
        PreToolUse: expect.arrayContaining([
          {
            matcher: 'Edit|Write|MultiEdit',
            hooks: [
              {
                type: 'command',
                command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/change-reference.mjs"',
                timeout: 10,
              },
            ],
          },
        ]),
      },
    });

    for (const file of [
      'migrations/0001_add_invoices.sql',
      'prisma/migrations/20260101_init/migration.sql',
      'docker/varnish/default.vcl',
      'Dockerfile',
      'docker-compose.yml',
    ]) {
      const asked = runHook(root, REFERENCE, edit(root, file));

      expect(asked.status, file).toBe(0);

      expect(JSON.parse(asked.stdout)).toEqual({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: expect.stringContaining(
            `change-reference: ${file} is a migration or part of the containers`,
          ),
        },
      });

      expect(asked.stdout).toContain('record it as the trailer `Change: <id>` of the commit that holds this file');
    }
  });

  it('says nothing for any other file, another tool, a file outside the project or an unreadable input', () => {
    expect(runHook(root, REFERENCE, edit(root, 'src/contexts/billing/domain/invoice.ts')).stdout).toBe('');
    expect(runHook(root, REFERENCE, edit(root, 'docs/migrations-plan.md')).stdout).toBe('');

    expect(
      runHook(root, REFERENCE, { tool_name: 'Read', cwd: root, tool_input: { file_path: 'Dockerfile' } }).stdout,
    ).toBe('');

    expect(
      runHook(root, REFERENCE, {
        tool_name: 'Edit',
        cwd: root,
        tool_input: { file_path: '/elsewhere/migrations/a.sql' },
      }).stdout,
    ).toBe('');

    expect(
      runHook(root, REFERENCE, { tool_name: 'Write', tool_input: { file_path: 'docker-compose.yml' } }).stdout,
    ).toContain('"ask"');

    const unreadable = spawnSync(process.execPath, [path.join(root, REFERENCE)], {
      cwd: root,
      input: '{',
      encoding: 'utf8',
    });

    expect(unreadable.status).toBe(0);
    expect(JSON.parse(unreadable.stdout)).toMatchObject({ hookSpecificOutput: { permissionDecision: 'ask' } });
  });

  it.each([null, 'x', 7])('asks when the input is JSON but no object: %s', (scalar) => {
    const run = runHook(root, REFERENCE, scalar);

    expect(run.status).toBe(0);
    expect(run.stdout).toContain('the input is not a JSON object');
    expect(JSON.parse(run.stdout)).toMatchObject({ hookSpecificOutput: { permissionDecision: 'ask' } });
  });

  it('asks for the containers and migrations of a worktree, of a second compose file, of a MultiEdit and from a subdirectory', () => {
    const project = tempDir('hooks-places');

    write(project, 'README.md', 'x');
    git(project, 'init', '--quiet', '-b', 'main');
    git(project, 'add', '-A');
    git(project, 'commit', '--quiet', '-m', 'init');
    git(project, 'worktree', 'add', '--quiet', '-b', 'us1', '.worktrees/us1');

    const asks = (input: unknown): boolean => runHook(root, REFERENCE, input).stdout.includes('"ask"');

    const at = (tool_name: string, cwd: string, file: string): unknown => ({
      tool_name,
      cwd,
      tool_input: { file_path: file },
    });

    expect(asks(at('Edit', project, path.join(project, '.worktrees/us1/Dockerfile')))).toBe(true);
    expect(asks(at('Edit', project, path.join(project, '.worktrees/us1/docker-compose.yml')))).toBe(true);
    expect(asks(at('Edit', project, path.join(project, '.worktrees/us1/docker/varnish.vcl')))).toBe(true);
    expect(asks(at('Edit', path.join(project, 'src'), path.join(project, 'Dockerfile')))).toBe(true);
    expect(asks(at('MultiEdit', project, path.join(project, 'Dockerfile')))).toBe(true);
    expect(asks(at('Write', project, path.join(project, 'docker-compose.override.yml')))).toBe(true);
    expect(asks(at('Edit', project, path.join(project, 'src/apps/billing/Dockerfile')))).toBe(true);
    expect(asks(at('Edit', project, path.join(project, 'src/index.ts')))).toBe(false);
    expect(asks(at('Edit', project, path.join(`${project}..sibling`, 'Dockerfile')))).toBe(false);
    expect(asks(at('Edit', project, path.join(project, '.worktrees/us1/README.md')))).toBe(false);
  });
});
