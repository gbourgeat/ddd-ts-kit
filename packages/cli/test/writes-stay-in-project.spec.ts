import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir, walk, write } from './helpers';
import { initProject } from './support/init-project';
import { NPM } from './support/npm';
import { commitAll } from './support/commit-all';

/** A folder next to the project, where nothing of the project may land. */
function outside(): string {
  const directory = tempDir('outside');

  write(directory, 'settings.json', '{}\n');
  write(directory, 'victim.md', 'Mine.\n');

  return directory;
}

function link(root: string, file: string, target: string): void {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.symlinkSync(target, path.join(root, file));
}

describe.skipIf(process.platform === 'win32')('a write of the CLI stays inside the project', () => {
  it('refuses init, writing nothing, when .claude/settings.json is a link to a file out of the project', () => {
    const elsewhere = outside();
    const root = tempDir('linked-settings');

    link(root, '.claude/settings.json', path.join(elsewhere, 'settings.json'));

    const refused = cli(root, 'init', ...NPM);

    expect(refused.code).toBe(2);

    expect(refused.stderr).toContain(
      `file(s) of this command would be written out of the project: .claude/settings.json (which lands in ${path.join(fs.realpathSync(elsewhere), 'settings.json')}). Nothing was written.`,
    );

    expect(refused.stderr).toContain('put the file or the folder itself in place of each symbolic link that leads out');
    expect(read(elsewhere, 'settings.json')).toBe('{}\n');
    expect(exists(root, 'package.json')).toBe(false);
  });

  it('refuses generate adr when docs/adr is a link to a folder out of the project, and leaves that folder empty of it', () => {
    const elsewhere = outside();
    const root = initProject(...NPM);

    link(root, 'docs/adr', elsewhere);

    const refused = cli(root, 'generate', 'adr', 'Choose a broker');

    expect(refused.code).toBe(2);

    expect(refused.stderr).toContain(
      `docs/adr/0001-choose-a-broker.md (which lands in ${path.join(fs.realpathSync(elsewhere), '0001-choose-a-broker.md')})`,
    );

    expect(walk(elsewhere).sort()).toEqual(['settings.json', 'victim.md']);
  });

  it('refuses init --force when a file it rewrites is a link, and leaves the target as it was', () => {
    const elsewhere = outside();
    const root = initProject(...NPM);

    fs.rmSync(path.join(root, 'biome.json'));
    link(root, 'biome.json', path.join(elsewhere, 'victim.md'));

    const refused = cli(root, 'init', '--force');

    expect(refused.code).toBe(2);

    expect(refused.stderr).toContain(
      `biome.json (which lands in ${path.join(fs.realpathSync(elsewhere), 'victim.md')})`,
    );

    expect(read(elsewhere, 'victim.md')).toBe('Mine.\n');
  });

  it('writes through a link to a file of the project, and keeps the link', () => {
    const root = initProject(...NPM);

    write(root, 'tools/biome.json', '{}\n');
    fs.rmSync(path.join(root, 'biome.json'));
    link(root, 'biome.json', 'tools/biome.json');
    commitAll(root);

    const forced = cli(root, 'init', '--force');

    expect(forced.stderr).toBe('');
    expect(forced.code).toBe(0);
    expect(fs.lstatSync(path.join(root, 'biome.json')).isSymbolicLink()).toBe(true);
    expect(read(root, 'tools/biome.json')).toContain('"$schema"');
  });

  it('refuses --force through a link to a file of the project whose edit git does not hold', () => {
    const root = initProject(...NPM);

    write(root, 'tools/biome.json', '{}\n');
    fs.rmSync(path.join(root, 'biome.json'));
    link(root, 'biome.json', 'tools/biome.json');
    commitAll(root);
    write(root, 'tools/biome.json', '{ "edited": true }\n');

    const refused = cli(root, 'init', '--force');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('uncommitted or untracked: biome.json.');
    expect(read(root, 'tools/biome.json')).toBe('{ "edited": true }\n');
  });

  it('writes through a link that stays inside the project', () => {
    const root = initProject(...NPM);

    fs.mkdirSync(path.join(root, 'docs/decisions'), { recursive: true });
    link(root, 'docs/adr', path.join(root, 'docs/decisions'));

    expect(cli(root, 'generate', 'adr', 'Choose a broker').code).toBe(0);
    expect(walk(root, 'docs/decisions').some((file) => file.endsWith('-choose-a-broker.md'))).toBe(true);
  });
});

describe('init runs in the directory of a project only', () => {
  const home = process.env['HOME'];

  afterEach(() => {
    process.env['HOME'] = home;
  });

  it('refuses the home directory of the user, where .claude/settings.json holds the settings of every session', () => {
    const root = tempDir('home');

    process.env['HOME'] = root;

    const refused = cli(root, 'init', ...NPM, '--dry-run');

    expect(refused.code).toBe(2);

    expect(refused.stderr).toContain(
      `init does not run in your home directory (${fs.realpathSync(root)}): what it writes there, .claude/settings.json first, would apply to everything below it.`,
    );

    expect(refused.stderr).toContain('Run init in the directory of the project');
    expect(walk(root)).toEqual([]);
  });

  it('refuses the root of the file system', () => {
    const refused = cli(path.parse(process.cwd()).root, 'init', ...NPM, '--dry-run');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('init does not run in the root of the file system');
  });
});
