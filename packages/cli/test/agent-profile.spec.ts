import { describe, expect, it } from 'vitest';
import { parseConfig, serializeConfig } from '../src/config';
import { cli, read, tempDir, write } from './helpers';
import { git } from './support/git';
import { initProject } from './support/init-project';
import { installKit } from './support/install-kit';
import { jsonAt } from './support/json-at';
import { NPM } from './support/npm';
import { readJson } from './support/read-json';
import { stringsAt } from './support/strings-at';
import { commitAll } from './support/commit-all';

const SETTINGS = '.claude/settings.json';
const CONFIG = 'ddd-ts-kit.config.json';

const sandboxOf = (root: string): Record<string, unknown> => {
  const settings = readJson(root, SETTINGS);

  return typeof settings === 'object' && settings !== null && 'sandbox' in settings
    ? (settings.sandbox as Record<string, unknown>)
    : {};
};

describe('init --agent-profile regulated', () => {
  it('writes the sandbox of Claude Code, records the profile, and prints the managed settings to paste', () => {
    const root = tempDir('regulated');
    const result = cli(root, 'init', ...NPM, '--agent-profile', 'regulated', '--json');

    expect(result.code).toBe(0);
    expect(readJson(root, CONFIG)).toMatchObject({ agents: { profile: 'regulated' } });

    expect(sandboxOf(root)).toEqual({
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      filesystem: { allowWrite: ['~/.npm'] },
      network: { allowedDomains: ['registry.npmjs.org'] },
      credentials: {
        files: [
          { path: '~/.ssh', mode: 'deny' },
          { path: '~/.aws', mode: 'deny' },
          { path: '~/.config/gcloud', mode: 'deny' },
          { path: '~/.azure', mode: 'deny' },
        ],
        envVars: expect.arrayContaining([
          { name: 'GITHUB_TOKEN', mode: 'deny' },
          { name: 'NPM_TOKEN', mode: 'deny' },
          { name: 'AWS_SECRET_ACCESS_KEY', mode: 'deny' },
        ]),
      },
    });

    const notes = stringsAt(result.json(), 'notes').join('\n');

    expect(notes).toContain('"allowManagedHooksOnly": true');
    expect(notes).toContain('"allowManagedPermissionRulesOnly": true');
    expect(notes).toContain('"disableBypassPermissionsMode": "disable"');
    expect(notes).toContain('"strictKnownMarketplaces": [');
    expect(notes).toContain('"repo": "gbourgeat/ddd-ts-kit"');
    expect(notes).toContain('"requiredMinimumVersion": "<the oldest version of Claude Code the team accepts>"');
    expect(notes).toContain('copy the hooks of .claude/settings.json into the managed settings too');
    expect(notes).toContain('a headless run (claude -p) in an untrusted workspace ignores them');
    expect(notes).toContain('hasTrustDialogAccepted');
    expect(read(root, SETTINGS)).not.toContain('allowManagedHooksOnly');
    expect(notes).toContain('Run the first `npm install` of this project yourself, outside the agent');
    expect(notes).not.toContain('install scripts of the stack');
  });
});

describe('init --agent-profile regulated, and the install of the stack', () => {
  it('lets the agent install the stack init chose: the caches of the package manager and of Prisma, the hosts of the engines of Prisma and of the Kafka client', () => {
    const root = tempDir('regulated');

    write(root, 'package.json', JSON.stringify({ name: 'lending', repository: 'gitlab:acme/lending' }));

    const result = cli(
      root,
      'init',
      ...NPM,
      '--orm',
      'prisma',
      '--broker',
      'kafka',
      '--agent-profile',
      'regulated',
      '--json',
    );

    expect(result.code).toBe(0);
    expect(jsonAt(sandboxOf(root), 'filesystem', 'allowWrite')).toEqual(['~/.npm', '~/.cache/prisma']);

    expect(jsonAt(sandboxOf(root), 'network', 'allowedDomains')).toEqual([
      'registry.npmjs.org',
      'gitlab.com',
      'binaries.prisma.sh',
      'github.com',
      'release-assets.githubusercontent.com',
    ]);

    const notes = stringsAt(result.json(), 'notes').join('\n');

    expect(notes).toContain('a path missing when the session starts stays read-only for the whole session');
    expect(notes).toContain('the engines of Prisma from binaries.prisma.sh');
    expect(notes).toContain('the prebuilt client of Kafka from github.com and release-assets.githubusercontent.com');
    expect(notes).toContain('builds librdkafka from sources');
    expect(notes).toContain('Claude Code ignores sandbox.filesystem.allowWrite and sandbox.network.allowedDomains');

    const pnpm = tempDir('regulated');

    cli(pnpm, 'init', '--package-manager', 'pnpm', '--orm', 'drizzle', '--agent-profile', 'regulated');

    expect(jsonAt(sandboxOf(pnpm), 'filesystem', 'allowWrite')).toEqual([
      '~/.local/share/pnpm/store',
      '~/.cache/pnpm',
      '~/Library/pnpm/store',
      '~/Library/Caches/pnpm',
    ]);

    expect(jsonAt(sandboxOf(pnpm), 'network', 'allowedDomains')).toEqual(['registry.npmjs.org']);
  });

  it('reports a sandbox emptied of its content: a wildcard host, credential lists that deny something else', () => {
    const root = initProject(...NPM, '--agent-profile', 'regulated');
    const settings = readJson(root, SETTINGS) as Record<string, unknown>;

    write(
      root,
      SETTINGS,
      JSON.stringify({
        ...settings,
        sandbox: {
          ...sandboxOf(root),
          network: { allowedDomains: ['*', 'registry.npmjs.org'] },
          credentials: { files: [{ path: '/nowhere', mode: 'deny' }], envVars: [{ name: 'X', mode: 'deny' }] },
        },
      }),
    );

    const doctor = cli(root, 'doctor');

    expect(doctor.stdout).toContain('permission sandbox.network.allowedDomains: missing');
    expect(doctor.stdout).toContain('permission sandbox.credentials.files: missing (4 denied)');
    expect(doctor.stdout).toContain('permission sandbox.credentials.envVars: missing (9 denied)');
    expect(cli(initProject(...NPM, '--agent-profile', 'regulated'), 'doctor').stdout).not.toContain('sandbox.');
  });

  it('adds the entries of a stack chosen later to the lists a project already holds, and doctor names a missing one', () => {
    const root = initProject(...NPM, '--orm', 'drizzle', '--agent-profile', 'regulated');
    const settings = readJson(root, SETTINGS) as Record<string, unknown>;

    write(
      root,
      SETTINGS,
      JSON.stringify({
        ...settings,
        sandbox: { ...sandboxOf(root), filesystem: { allowWrite: ['/tmp/build'] } },
      }),
    );

    write(root, CONFIG, read(root, CONFIG).replace('"orm": "drizzle"', '"orm": "prisma"'));

    expect(cli(root, 'doctor').stdout).toContain(
      '  permission sandbox.filesystem.allowWrite: missing (~/.npm, ~/.cache/prisma)',
    );

    expect(cli(root, 'doctor').stdout).toContain(
      '  permission sandbox.network.allowedDomains: missing (the npm registry, the git host and binaries.prisma.sh)',
    );

    cli(root, 'init');

    expect(jsonAt(sandboxOf(root), 'filesystem', 'allowWrite')).toEqual(['/tmp/build', '~/.npm', '~/.cache/prisma']);
    expect(jsonAt(sandboxOf(root), 'network', 'allowedDomains')).toEqual(['registry.npmjs.org', 'binaries.prisma.sh']);
  });
});

describe('init --agent-profile regulated, and the hosts and keys of the project', () => {
  it('allows the git host of the project, from package.json or from the origin remote', () => {
    const declared = tempDir('regulated');

    write(declared, 'package.json', JSON.stringify({ name: 'shop', repository: 'github:acme/shop' }));
    cli(declared, 'init', ...NPM, '--agent-profile', 'regulated');

    expect(jsonAt(sandboxOf(declared), 'network', 'allowedDomains')).toEqual(['registry.npmjs.org', 'github.com']);

    const cloned = tempDir('regulated');

    git(cloned, 'init', '--quiet');
    git(cloned, 'remote', 'add', 'origin', 'git@gitlab.example.com:acme/shop.git');
    cli(cloned, 'init', ...NPM, '--agent-profile', 'regulated');

    expect(jsonAt(sandboxOf(cloned), 'network', 'allowedDomains')).toEqual([
      'registry.npmjs.org',
      'gitlab.example.com',
    ]);

    const https = tempDir('regulated');

    write(
      https,
      'package.json',
      JSON.stringify({ name: 'shop', repository: { url: 'git+https://git.acme.io/acme/shop.git' } }),
    );

    cli(https, 'init', ...NPM, '--agent-profile', 'regulated');

    expect(jsonAt(sandboxOf(https), 'network', 'allowedDomains')).toEqual(['registry.npmjs.org', 'git.acme.io']);
  });

  it('keeps the sandbox keys a project set, adds the ones of the profile beside them, and refuses an unknown profile', () => {
    const root = tempDir('regulated');

    write(
      root,
      SETTINGS,
      JSON.stringify({
        sandbox: { enabled: true, network: { allowedDomains: ['registry.npmjs.org', 'jfrog.acme.io'] } },
      }),
    );

    cli(root, 'init', ...NPM, '--agent-profile', 'regulated');

    expect(sandboxOf(root)).toMatchObject({
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      network: { allowedDomains: ['registry.npmjs.org', 'jfrog.acme.io'] },
    });

    const refused = cli(tempDir('regulated'), 'init', ...NPM, '--agent-profile', 'lax');

    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('Unknown value "lax" for --agent-profile');
  });
});

describe('init --agent-profile, in the config and under doctor', () => {
  it('is set on an existing project without --force, kept by init run again, removed by --agent-profile none, and round-trips through the config', () => {
    const root = initProject(...NPM);

    expect(read(root, CONFIG)).not.toContain('"agents"');

    const added = cli(root, 'init', '--agent-profile', 'regulated', '--json').json();

    expect(stringsAt(added, 'updated')).toEqual(expect.arrayContaining([CONFIG, SETTINGS]));
    expect(readJson(root, CONFIG)).toMatchObject({ agents: { profile: 'regulated' } });
    expect(sandboxOf(root)).toMatchObject({ enabled: true });

    cli(root, 'init');

    expect(readJson(root, CONFIG)).toMatchObject({ agents: { profile: 'regulated' } });

    cli(root, 'init', '--agent-profile', 'none');

    expect(read(root, CONFIG)).not.toContain('"agents"');

    commitAll(root);
    cli(root, 'init', '--force', '--agent-profile', 'regulated');

    expect(readJson(root, CONFIG)).toMatchObject({ agents: { profile: 'regulated' } });

    expect(serializeConfig(parseConfig({ agents: { profile: 'regulated' } }))).toMatch(
      /"agents": \{\s*"profile": "regulated"\s*\}/,
    );

    expect(parseConfig({ agents: { profile: '' } }).agents.profile).toBeUndefined();
  });

  it('is reported by doctor when the settings lack the sandbox the profile asks for', () => {
    const root = initProject(...NPM, '--agent-profile', 'regulated');

    installKit(root);

    expect(cli(root, 'doctor', '--strict').code).toBe(0);

    write(root, SETTINGS, JSON.stringify({ permissions: readJson(root, SETTINGS) }));

    const settings = readJson(root, SETTINGS) as Record<string, unknown>;

    write(root, SETTINGS, JSON.stringify({ ...settings, sandbox: { enabled: true, allowUnsandboxedCommands: true } }));

    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(1);
    expect(result.stdout).not.toContain('sandbox.enabled');
    expect(result.stdout).toContain('  permission sandbox.failIfUnavailable: missing (true)');
    expect(result.stdout).toContain('  permission sandbox.allowUnsandboxedCommands: missing (false)');

    expect(result.stdout).toContain(
      '  permission sandbox.network.allowedDomains: missing (the npm registry and the git host)',
    );

    expect(result.stdout).toContain('  permission sandbox.credentials.files: missing (4 denied)');
    expect(result.stdout).toContain('  permission sandbox.credentials.envVars: missing (9 denied)');

    // init adds what is missing and keeps a key the project set otherwise: that one stays reported until the team changes it.
    cli(root, 'init');

    const kept = cli(root, 'doctor', '--strict');

    expect(kept.code).toBe(1);
    expect(kept.stdout).toContain('  permission sandbox.allowUnsandboxedCommands: missing (false)');
    expect(kept.stdout).not.toContain('sandbox.failIfUnavailable');

    const current = readJson(root, SETTINGS) as Record<string, unknown>;

    write(
      root,
      SETTINGS,
      JSON.stringify({ ...current, sandbox: { ...sandboxOf(root), allowUnsandboxedCommands: false } }),
    );

    expect(cli(root, 'doctor', '--strict').code).toBe(0);
  });
});
