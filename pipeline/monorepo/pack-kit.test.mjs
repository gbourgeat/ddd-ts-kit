import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { packKit } from './pack-kit.mjs';

const SCRIPT = path.resolve(import.meta.dirname, 'pack-kit.mjs');

test('packs every package once and names each tarball in kit.json', () => {
  const root = workspace();
  const destination = path.join(root, 'packed');
  const file = packKit(path.join(root, 'packages'), destination);

  assert.equal(file, path.join(destination, 'kit.json'));

  const kit = JSON.parse(fs.readFileSync(file, 'utf8'));

  assert.deepEqual(Object.keys(kit), ['@kit/alpha', '@kit/beta']);
  assert.equal(kit['@kit/alpha'], `file:${path.join(destination, 'kit-alpha-1.2.3.tgz')}`);

  for (const specifier of Object.values(kit)) {
    assert.ok(fs.existsSync(specifier.replace(/^file:/, '')), `${specifier} was not written`);
  }
});

test('asks for a destination', () => {
  const run = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });

  assert.equal(run.status, 2);
  assert.match(run.stderr, /usage: node pipeline\/monorepo\/pack-kit\.mjs <destination>/);
});

/** A workspace of two packages that `npm pack` can pack offline. */
function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-kit-'));

  for (const name of ['alpha', 'beta']) {
    const directory = path.join(root, 'packages', name);

    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: `@kit/${name}`, version: '1.2.3' }));
    fs.writeFileSync(path.join(directory, 'index.js'), 'export {};\n');
  }

  return root;
}
