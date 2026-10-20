import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Workspace } from '../src/workspace/index.js';
import { tempDir, write } from './helpers.js';

const FILE = 'src/contexts/billing/application/commands/commands.declarations.ts';

function workspace(files: Readonly<Record<string, string>>): Workspace {
  const root = tempDir('workspace-delete');

  for (const [file, text] of Object.entries(files)) {
    write(root, file, text);
  }

  return new Workspace(root, false);
}

describe('a file the workspace deletes', () => {
  it('is gone for the steps that follow, and from the disk at the commit, which reports it', () => {
    const ws = workspace({ [FILE]: 'export {};\n' });

    ws.delete(FILE);

    expect(ws.exists(FILE)).toBe(false);
    expect(ws.read(FILE)).toBeUndefined();
    expect(ws.list(path.posix.dirname(FILE))).toEqual([]);

    const report = ws.commit(false);

    expect(report.deleted).toEqual([FILE]);
    expect(report.updated).toEqual([]);
    expect(fs.existsSync(path.join(ws.root, FILE))).toBe(false);
  });

  it('stays on disk under --dry-run, and is still reported', () => {
    const ws = workspace({ [FILE]: 'export {};\n' });

    ws.delete(FILE);

    expect(ws.commit(true).deleted).toEqual([FILE]);
    expect(fs.existsSync(path.join(ws.root, FILE))).toBe(true);
  });

  it('is forgotten when it was only planned, and nothing is reported', () => {
    const ws = workspace({});

    ws.create(FILE, 'export {};\n');
    ws.delete(FILE);

    const report = ws.commit(false);

    expect(report).toMatchObject({ created: [], deleted: [] });
    expect(fs.existsSync(path.join(ws.root, FILE))).toBe(false);
  });

  it('is written again when a later step derives it after all', () => {
    const ws = workspace({ [FILE]: 'export {};\n' });

    ws.delete(FILE);
    ws.update(FILE, 'export {};\n');

    expect(ws.commit(false)).toMatchObject({ updated: [], deleted: [] });
    expect(fs.readFileSync(path.join(ws.root, FILE), 'utf8')).toBe('export {};\n');

    const again = workspace({ [FILE]: 'export {};\n' });

    again.delete(FILE);
    again.create(FILE, "export * from './a';\n");

    expect(again.commit(false)).toMatchObject({ created: [], updated: [FILE], deleted: [] });
  });
});
