import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';
import { initProject } from './support/init-project';
import { installKit } from './support/install-kit';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';
import { stringsAt } from './support/strings-at';

const NPM = ['--package-manager', 'npm'];
const PNPM = ['--package-manager', 'pnpm'];
const STACK = ['--orm', 'prisma', '--broker', 'kafka'];
const ENGINES = '@prisma/engines';
const KAFKA = '@confluentinc/kafka-javascript';

const allowScriptsOf = (root: string): unknown => jsonAt(readJson(root, 'package.json'), 'allowScripts');

const notesOf = (result: { json(): unknown }): string => stringsAt(result.json(), 'notes').join('\n');

function setManifest(root: string, change: (manifest: Record<string, unknown>) => Record<string, unknown>): void {
  write(root, 'package.json', JSON.stringify(change(JSON.parse(read(root, 'package.json')))));
}

describe('init allows the install scripts the stack needs, by name', () => {
  it('writes the engines of Prisma and the Kafka client to allowScripts of package.json under npm', () => {
    const root = tempDir('init');
    const result = cli(root, 'init', ...NPM, ...STACK, '--json');

    expect(result.code, result.stderr).toBe(0);
    expect(allowScriptsOf(root)).toEqual({ [ENGINES]: true, [KAFKA]: true });

    const notes = notesOf(result);

    expect(notes).toContain('package.json allows by name, in `allowScripts`, the install scripts the stack needs');
    expect(notes).toContain('`npm install-scripts ls`');
  });

  it('writes nothing on a stack whose install scripts the project does not need', () => {
    const root = initProject(...NPM, '--orm', 'drizzle', '--broker', 'rabbitmq');

    expect(allowScriptsOf(root)).toBeUndefined();
    expect(read(initProject(...PNPM, '--orm', 'knex'), 'pnpm-workspace.yaml')).not.toMatch(/^allowBuilds:/m);
  });

  it('writes them to allowBuilds of pnpm-workspace.yaml under pnpm, which runs no build script it is not told to', () => {
    const root = tempDir('init');
    const result = cli(root, 'init', ...PNPM, ...STACK, '--json');

    expect(result.code, result.stderr).toBe(0);

    expect(read(root, 'pnpm-workspace.yaml')).toMatch(
      /^allowBuilds:\n {2}'@prisma\/engines': true\n {2}'@confluentinc\/kafka-javascript': true\n/m,
    );

    expect(read(root, 'pnpm-workspace.yaml')).toMatch(/^strictDepBuilds: false$/m);
    expect(allowScriptsOf(root)).toBeUndefined();

    expect(notesOf(result)).toContain(
      'pnpm-workspace.yaml allows by name, in `allowBuilds`, the build scripts the stack needs',
    );
  });

  it('changes nothing when run again', () => {
    const npm = initProject(...NPM, ...STACK);
    const pnpm = initProject(...PNPM, ...STACK);
    const [manifest, workspace] = [read(npm, 'package.json'), read(pnpm, 'pnpm-workspace.yaml')];

    cli(npm, 'init', ...NPM, ...STACK);
    cli(pnpm, 'init', ...PNPM, ...STACK);

    expect(read(npm, 'package.json')).toBe(manifest);
    expect(read(pnpm, 'pnpm-workspace.yaml')).toBe(workspace);
  });

  it('keeps a pin and a denial the project wrote, even with --force, and says the denial', () => {
    const root = initProject(...NPM, ...STACK);

    setManifest(root, (manifest) => ({
      ...manifest,
      allowScripts: { [`${ENGINES}@7.10.1`]: true, [KAFKA]: false, esbuild: false },
    }));

    const result = cli(root, 'init', ...NPM, ...STACK, '--force', '--json');

    expect(allowScriptsOf(root)).toEqual({ [`${ENGINES}@7.10.1`]: true, [KAFKA]: false, esbuild: false });

    expect(notesOf(result)).toContain(
      `package.json denies, in \`allowScripts\`, the install script of ${KAFKA}, which the stack needs`,
    );
  });

  it('says what an allowBuilds block of the project lacks, and leaves the block as it is', () => {
    const root = tempDir('init');

    write(root, 'package.json', JSON.stringify({ name: 'shop' }));
    write(root, 'pnpm-workspace.yaml', "allowBuilds:\n  esbuild: true\n  '@prisma/engines@7.10.1': true\n");

    const notes = notesOf(cli(root, 'init', ...PNPM, ...STACK, '--json'));

    expect(notes).toContain(
      `pnpm-workspace.yaml has an \`allowBuilds\` block of its own: add \`'${KAFKA}': true\` to it`,
    );

    expect(notes).not.toContain(`add \`'${ENGINES}': true\``);

    expect(read(root, 'pnpm-workspace.yaml')).toMatch(
      /^allowBuilds:\n {2}esbuild: true\n {2}'@prisma\/engines@7\.10\.1': true\n/,
    );
  });

  it('tells the owner of a regulated project to pin them after the first install, and what a bump then asks', () => {
    const npm = notesOf(cli(tempDir('init'), 'init', ...NPM, ...STACK, '--agent-profile', 'regulated', '--json'));

    expect(npm).toContain(`\`npm install-scripts approve ${ENGINES} ${KAFKA}\` turns the names init wrote`);
    expect(npm).toContain('A bump of one of them, a Dependabot pull request for one, then needs the same step again');
    expect(npm).toContain('npm 11.19 runs the new script with a warning');

    const pnpm = notesOf(cli(tempDir('init'), 'init', ...PNPM, ...STACK, '--agent-profile', 'regulated', '--json'));

    expect(pnpm).toContain("`'<package>@<version>': true` in place of its name");
    expect(pnpm).toContain('pnpm skips the new script');
  });
});

/** A package as an install leaves it: its manifest at a version. */
function installPackage(root: string, directory: string, version: string): void {
  write(root, `${directory}/package.json`, JSON.stringify({ name: path.basename(directory), version }));
}

function installedStack(manager: 'npm' | 'pnpm'): string {
  const root = path.join(tempDir(`doctor-install-scripts-${manager}`), 'shop');

  cli(root, 'init', '--package-manager', manager, ...STACK);
  installKit(root);

  if (manager === 'pnpm') {
    const store = 'node_modules/.pnpm/prisma@7.10.1/node_modules';

    installPackage(root, `${store}/prisma`, '7.10.1');
    installPackage(root, `${store}/@prisma/engines`, '7.10.1');
    fs.symlinkSync(path.join(root, store, 'prisma'), path.join(root, 'node_modules/prisma'));
  } else {
    installPackage(root, 'node_modules/prisma', '7.10.1');
    installPackage(root, `node_modules/${ENGINES}`, '7.10.1');
  }

  installPackage(root, `node_modules/${KAFKA}`, '1.11.0');

  return root;
}

const findingsOf = (root: string): unknown => jsonAt(cli(root, 'doctor', '--json').json(), 'findings');

describe('doctor, on the install scripts the stack needs', () => {
  it('says nothing while the allow list allows each installed version, by name or pinned', () => {
    const root = installedStack('npm');

    expect(findingsOf(root)).toEqual([]);

    setManifest(root, (manifest) => ({
      ...manifest,
      allowScripts: { [`${ENGINES}@7.10.0 || 7.10.1`]: true, [`${KAFKA}@1.11.0`]: true },
    }));

    expect(findingsOf(root)).toEqual([]);
  });

  it('fails --strict on a pin the last bump left behind, with the command that approves the new version', () => {
    const root = installedStack('npm');

    setManifest(root, (manifest) => ({ ...manifest, allowScripts: { [`${ENGINES}@7.9.0`]: true, [KAFKA]: true } }));

    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(1);

    expect(result.stdout).toContain(
      `  install-script ${ENGINES}: other version (${ENGINES}@7.10.1 allowed in allowScripts of package.json; yours: allowed for ${ENGINES}@7.9.0)`,
    );

    expect(result.stdout).toContain(`\`npm install-scripts approve ${ENGINES}\` pins it to that version`);
    expect(result.stdout).not.toContain('fix: `npx ddd-ts-kit init` adds what is missing');
  });

  it('reports a script the list does not name, which init adds', () => {
    const root = installedStack('npm');

    setManifest(root, (manifest) => ({ ...manifest, allowScripts: undefined }));

    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(1);

    expect(result.stdout).toContain(
      `  install-script ${KAFKA}: missing (${KAFKA}@1.11.0 allowed in allowScripts of package.json; yours: 1.11.0 installed, its script unreviewed)`,
    );

    expect(result.stdout).toContain('fix: `npx ddd-ts-kit init` adds what is missing');
  });

  it('reports a denial without failing --strict: the team may build the package another way', () => {
    const root = installedStack('npm');

    setManifest(root, (manifest) => ({ ...manifest, allowScripts: { [ENGINES]: true, [KAFKA]: false } }));

    const result = cli(root, 'doctor', '--strict');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(`  install-script ${KAFKA}: written otherwise`);
    expect(result.stdout).toContain(`note: the stack needs the install script of ${KAFKA}`);
  });

  it('reads allowBuilds of pnpm-workspace.yaml under pnpm, and the engines from the real place of prisma', () => {
    const root = installedStack('pnpm');

    expect(findingsOf(root)).toEqual([]);

    write(
      root,
      'pnpm-workspace.yaml',
      `strictDepBuilds: false\nallowBuilds:\n  '${ENGINES}@7.9.0': true\n  '${KAFKA}': true\n`,
    );

    const result = cli(root, 'doctor');

    expect(result.stdout).toContain(
      `  install-script ${ENGINES}: other version (${ENGINES}@7.10.1 allowed in allowBuilds of pnpm-workspace.yaml; yours: allowed for ${ENGINES}@7.9.0)`,
    );

    expect(result.stdout).toContain(`pnpm rebuild ${ENGINES}`);
  });

  it('judges no package that is not installed', () => {
    const root = path.join(tempDir('doctor-install-scripts'), 'shop');

    cli(root, 'init', ...NPM, ...STACK);
    installKit(root);
    setManifest(root, (manifest) => ({ ...manifest, allowScripts: undefined }));

    expect(findingsOf(root)).toEqual([]);
  });
});
