import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Workspace } from '../src/workspace';
import { cli, tempDir } from './helpers';
import { initProject } from './support/init-project';
import { NPM } from './support/npm';

describe('a file a command updates', () => {
  it('is reported created when it was not on disk, updated when it was', () => {
    const root = tempDir('workspace-update');

    fs.writeFileSync(path.join(root, 'there.md'), 'Before.\n');

    const ws = new Workspace(root, false);

    ws.update('there.md', 'After.\n');
    ws.update('new.md', 'First.\n');

    const report = ws.commit(false);

    expect(report.created).toEqual(['new.md']);
    expect(report.updated).toEqual(['there.md']);
  });

  it('is the derived dependency-cruiser file a first depcruise-config --write creates on a fresh project', () => {
    const root = initProject(...NPM);

    fs.rmSync(path.join(root, '.dependency-cruiser.cjs'));

    const ws = new Workspace(root, false);

    ws.update('.dependency-cruiser.cjs', 'module.exports = {};\n');

    expect(ws.commit(true).created).toEqual(['.dependency-cruiser.cjs']);
    expect(cli(root, 'depcruise-config', '--write').code).toBe(0);
    expect(fs.existsSync(path.join(root, '.dependency-cruiser.cjs'))).toBe(true);
  });
});
