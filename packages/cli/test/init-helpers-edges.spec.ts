import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config';
import { copilotInstruction } from '../src/init/copilot-instruction';
import { gitHostOf } from '../src/init/git-host-of';
import { ignoreWorktrees } from '../src/init/ignore-worktrees';
import { writeInstallScripts } from '../src/init/manifest/write-install-scripts';
import { writeOverrides } from '../src/init/manifest/write-overrides';
import { recordAgentProfile } from '../src/init/record-agent-profile';
import { refuseUnprojectedRoot } from '../src/init/refuse-unprojected-root';
import { rewirePersonalData } from '../src/init/rewire-personal-data';
import { writeCopilotSettings } from '../src/init/write-copilot-settings';
import { Workspace } from '../src/workspace';
import { read, tempDir, write } from './helpers';

const PNPM_WORKSPACE = 'pnpm-workspace.yaml';
const COPILOT_SETTINGS = '.github/copilot/settings.json';
const NPM_PRISMA = parseConfig({ stack: { orm: 'prisma' } });
const PNPM_PRISMA = parseConfig({ stack: { orm: 'prisma', packageManager: 'pnpm' } });

/** A project directory holding `files`, and a workspace on it. */
function workspaceWith(label: string, files: Readonly<Record<string, string>>): { root: string; ws: Workspace } {
  const root = tempDir(label);

  for (const [file, content] of Object.entries(files)) {
    write(root, file, content);
  }

  return { root, ws: new Workspace(root, false) };
}

describe('what init reads of a project, when it is not what a project of the kit holds', () => {
  it('turns no rule without a frontmatter into a Copilot instruction', () => {
    expect(copilotInstruction('No frontmatter here.\n')).toBeUndefined();
  });

  it('reads the host of a repository written as owner/name, and none from a URL it cannot parse', () => {
    const github = tempDir('host-github');
    const unreadable = tempDir('host-unreadable');

    write(github, 'package.json', JSON.stringify({ repository: 'owner/name' }));
    write(unreadable, 'package.json', JSON.stringify({ repository: 'http://[' }));

    expect(gitHostOf(github)).toBe('github.com');
    expect(gitHostOf(unreadable)).toBeUndefined();
  });

  it('leaves a .gitignore whose team already decided on .worktrees', () => {
    const { ws } = workspaceWith('ignore-decided', { '.gitignore': '.worktrees/*\n' });

    ignoreWorktrees(ws);

    expect(ws.notes).toEqual([]);
    expect(ws.commit(false).updated).toEqual([]);
  });

  it('does not run where the directory does not exist yet', () => {
    expect(() => refuseUnprojectedRoot(path.join(os.tmpdir(), 'ddd-ts-kit-nowhere', 'shop'))).not.toThrow();
  });

  it('leaves a package.json that holds no object alone, scripts and overrides alike', () => {
    const { ws } = workspaceWith('manifest-array', { 'package.json': '[]' });

    writeInstallScripts(ws, NPM_PRISMA);
    writeOverrides(ws, NPM_PRISMA, false);

    expect(ws.notes).toEqual([]);
    expect(ws.commit(false).updated).toEqual([]);
  });

  it('says which install script a pnpm workspace denies, and writes the workspace file of a project without one', () => {
    const denying = workspaceWith('pnpm-denies', { [PNPM_WORKSPACE]: "allowBuilds:\n  '@prisma/engines': false\n" });
    const without = workspaceWith('pnpm-without', {});
    const overridden = workspaceWith('pnpm-overridden', {});

    writeInstallScripts(denying.ws, PNPM_PRISMA);
    writeInstallScripts(without.ws, PNPM_PRISMA);
    writeOverrides(overridden.ws, PNPM_PRISMA, false);

    expect(denying.ws.notes.join('\n')).toContain(
      `${PNPM_WORKSPACE} denies, in \`allowBuilds\`, the install script of @prisma/engines, which the stack needs`,
    );

    expect(without.ws.commit(false).created).toEqual([PNPM_WORKSPACE]);
    expect(read(without.root, PNPM_WORKSPACE)).toContain("allowBuilds:\n  '@prisma/engines': true\n");
    expect(overridden.ws.commit(false).created).toEqual([PNPM_WORKSPACE]);
    expect(read(overridden.root, PNPM_WORKSPACE)).toContain('overrides:\n');
  });

  it('records the agent profile in no config that is missing or not JSON', () => {
    const missing = workspaceWith('profile-missing', {});
    const broken = workspaceWith('profile-broken', { 'ddd-ts-kit.config.json': '{' });

    recordAgentProfile(missing.ws, parseConfig({ agents: { profile: 'regulated' } }));
    recordAgentProfile(broken.ws, parseConfig({ agents: { profile: 'regulated' } }));

    expect(missing.ws.commit(false).created).toEqual([]);
    expect(broken.ws.commit(false).updated).toEqual([]);
  });

  it('lists no personal data of a project whose privacy is off', () => {
    const { ws } = workspaceWith('privacy-off', {});

    rewirePersonalData(ws, parseConfig({}), 'billing');

    expect(ws.notes).toEqual([]);
  });

  it('leaves the Copilot settings alone when they hold no object', () => {
    const { ws } = workspaceWith('copilot-array', { [COPILOT_SETTINGS]: '[]' });

    writeCopilotSettings(ws);

    expect(ws.notes).toEqual([`${COPILOT_SETTINGS} is not a JSON object: it was left as it is.`]);
    expect(ws.commit(false).updated).toEqual([]);
  });
});
