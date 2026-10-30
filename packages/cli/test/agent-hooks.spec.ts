import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, write } from './helpers';
import { initProject } from './support/init-project';
import { installKit } from './support/install-kit';
import { NPM } from './support/npm';
import { readJson } from './support/read-json';
import { commitAll } from './support/commit-all';

const SETTINGS = '.claude/settings.json';
const GATE = '.claude/hooks/production-gate.mjs';
const REFERENCE = '.claude/hooks/change-reference.mjs';

interface HookRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs a hook the way Claude Code does: the JSON of the tool call on its standard input. */
function runHook(root: string, hook: string, input: unknown, env: Record<string, string> = {}): HookRun {
  const { status, stdout, stderr } = spawnSync(process.execPath, [path.join(root, hook)], {
    cwd: root,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, RELEASE_APPROVAL: '', ...env },
  });

  return { status, stdout, stderr };
}

const bash = (command: string): unknown => ({ tool_name: 'Bash', tool_input: { command } });

const edit = (root: string, file: string): unknown => ({
  tool_name: 'Edit',
  cwd: root,
  tool_input: { file_path: path.join(root, file) },
});

describe('the production gate of the regulated profile', () => {
  const root = initProject(...NPM, '--agent-profile', 'regulated');

  it('is written once with the profile, registered on the Bash tool, and left to the team', () => {
    expect(read(root, GATE)).toContain("const PRODUCTION_ENVIRONMENTS = ['production'];");
    expect(read(root, GATE)).toContain("const RELEASE_ACTIONS = ['deploy', 'migrate', 'rollback'];");

    expect(readJson(root, SETTINGS)).toMatchObject({
      hooks: {
        PreToolUse: expect.arrayContaining([
          {
            matcher: 'Bash',
            hooks: [
              { type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/production-gate.mjs"', timeout: 10 },
            ],
          },
        ]),
      },
    });

    write(root, GATE, '// ours\n');
    cli(root, 'init');

    expect(read(root, GATE)).toBe('// ours\n');

    commitAll(root);
    cli(root, 'init', '--force');

    expect(read(root, GATE)).toContain('production-gate');
  });

  it('blocks a command that names the production environment with a release action, with the reason, unless RELEASE_APPROVAL names an approver and a change', () => {
    const blocked = runHook(root, GATE, bash('npm run deploy -- --env production'));

    expect(blocked.status).toBe(2);

    expect(blocked.stderr).toContain(
      'names the production environment ("production") with a release action ("deploy")',
    );

    expect(blocked.stderr).toContain('RELEASE_APPROVAL="<approver> <change id>"');
    expect(blocked.stderr).toContain('the release checklist of the team');
    expect(blocked.stdout).toBe('');

    const approved = runHook(root, GATE, bash('npm run deploy -- --env production'), {
      RELEASE_APPROVAL: 'lea CHG-1234',
    });

    expect(approved.status).toBe(0);
    expect(approved.stderr).toContain('deploy on production approved by lea for change CHG-1234');

    expect(runHook(root, GATE, bash('npm run deploy -- --env production'), { RELEASE_APPROVAL: 'lea' }).status).toBe(2);

    expect(runHook(root, GATE, bash('PRODUCTION=1 npm run db:migrate'), { RELEASE_APPROVAL: 'lea:CHG-1' }).status).toBe(
      0,
    );
  });

  it('blocks a release whose name joins the environment and the action with a dash, an underscore or a dot, and not another environment', () => {
    for (const command of [
      'pnpm run deploy-production',
      'pnpm run deploy_production',
      'pnpm run production-deploy',
      'npm run db:migrate-production',
      'NODE_ENV=production pnpm run db-migrate',
      'fly deploy --app api-production',
      'pnpm run deploy.production',
    ]) {
      expect(runHook(root, GATE, bash(command)).status, command).toBe(2);
    }

    for (const command of [
      'pnpm run deploy-non-production',
      'fly deploy --app api-pre-production',
      'pnpm run deploy_preproduction',
      'pnpm run reproduction-deploy',
    ]) {
      expect(runHook(root, GATE, bash(command)).status, command).toBe(0);
    }
  });

  it('lets every other command through, and reads the environments and actions of the team', () => {
    expect(runHook(root, GATE, bash('npm run db:migrate')).status).toBe(0);
    expect(runHook(root, GATE, bash('npm run verify')).status).toBe(0);
    expect(runHook(root, GATE, bash('echo reproduction-deployment')).status).toBe(0);

    expect(runHook(root, GATE, { tool_name: 'Edit', tool_input: { file_path: 'production-deploy.md' } }).status).toBe(
      0,
    );

    expect(runHook(root, GATE, bash('kubectl rollout undo deployment/api -n prod-eu')).status).toBe(0);

    const custom = runHook(root, GATE, bash('kubectl rollout undo deployment/api -n prod-eu'), {
      PRODUCTION_GATE_ENVIRONMENTS: 'prod-eu,prod-us',
      PRODUCTION_GATE_ACTIONS: 'rollout',
    });

    expect(custom.status).toBe(2);
    expect(custom.stderr).toContain('("prod-eu")');

    const unreadable = spawnSync(process.execPath, [path.join(root, GATE)], {
      cwd: root,
      input: 'not json',
      encoding: 'utf8',
    });

    expect(unreadable.status).toBe(0);
  });
});

describe('the change reference of the regulated profile', () => {
  const root = initProject(...NPM, '--agent-profile', 'regulated');

  it('is registered on the Edit and Write tools, and asks for a change reference on a migration or the containers, without blocking', () => {
    expect(readJson(root, SETTINGS)).toMatchObject({
      hooks: {
        PreToolUse: expect.arrayContaining([
          {
            matcher: 'Edit|Write',
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
    expect(unreadable.stdout).toBe('');
  });
});

describe('the hooks of the regulated profile, under init again and doctor', () => {
  it('keeps the hooks a project registered, adds the two of the profile once, and is reported by doctor when one is missing', () => {
    const root = tempDir('hooks');

    write(
      root,
      SETTINGS,
      JSON.stringify({
        hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo ours' }] }], Stop: [] },
      }),
    );

    cli(root, 'init', ...NPM, '--agent-profile', 'regulated');
    cli(root, 'init');

    const hooks = readJson(root, SETTINGS) as { hooks: { PreToolUse: unknown[]; Stop: unknown[] } };

    expect(hooks.hooks.PreToolUse).toHaveLength(3);
    expect(JSON.stringify(hooks.hooks.PreToolUse[0])).toContain('echo ours');
    expect(hooks.hooks.Stop).toEqual([]);
    expect(exists(root, GATE)).toBe(true);
    expect(exists(root, REFERENCE)).toBe(true);

    installKit(root);

    expect(cli(root, 'doctor', '--strict').code).toBe(0);

    const current = readJson(root, SETTINGS) as Record<string, unknown>;

    write(root, SETTINGS, JSON.stringify({ ...current, hooks: { PreToolUse: hooks.hooks.PreToolUse.slice(0, 2) } }));
    write(root, REFERENCE, '');

    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(1);

    expect(result.stdout).toContain(
      '  permission hooks.change-reference: missing (a PreToolUse hook on Edit|Write running node "$CLAUDE_PROJECT_DIR/.claude/hooks/change-reference.mjs")',
    );

    expect(result.stdout).not.toContain('hooks.production-gate');

    write(root, SETTINGS, JSON.stringify(current));
    expect(cli(root, 'doctor', '--strict').code).toBe(0);
  });

  it('reports a missing hook file under the profile only, and init writes it again', () => {
    const regulated = initProject(...NPM, '--agent-profile', 'regulated');

    installKit(regulated);
    fs.rmSync(path.join(regulated, GATE));

    const missing = cli(regulated, 'doctor', '--strict');

    expect(missing.code).toBe(1);
    expect(missing.stdout).toContain('  guidance .claude/hooks/production-gate.mjs: missing (the file init writes)');

    cli(regulated, 'init');

    expect(exists(regulated, GATE)).toBe(true);
    expect(cli(regulated, 'doctor', '--strict').code).toBe(0);

    const plain = initProject(...NPM);

    installKit(plain);

    expect(exists(plain, GATE)).toBe(false);
    expect(cli(plain, 'doctor', '--strict').code).toBe(0);
  });
});
