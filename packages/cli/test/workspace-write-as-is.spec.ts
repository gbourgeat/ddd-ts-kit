import { describe, expect, it } from 'vitest';
import { Workspace } from '../src/workspace/index.js';
import { read, tempDir, write } from './helpers.js';

describe('a workspace of a pnpm project', () => {
  it('speaks pnpm in what a command writes, and keeps as it is what a move carries', () => {
    const root = tempDir('workspace-as-is');
    const text = 'Run `npm run test` and compare package-lock.json.\n';

    write(root, 'ddd-ts-kit.config.json', JSON.stringify({ stack: { packageManager: 'pnpm' } }));

    const ws = new Workspace(root, false);

    ws.create('docs/written.md', text);
    ws.writeAsIs('docs/carried.md', text);
    ws.commit(false);

    expect(read(root, 'docs/written.md')).not.toBe(text);
    expect(read(root, 'docs/carried.md')).toBe(text);
  });
});
