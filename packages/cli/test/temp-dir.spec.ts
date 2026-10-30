import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { removeTempDir, tempDir, write } from './helpers';

describe('the throwaway directories of a spec', () => {
  it('stay until the end of the file, unless the case that made one removes it as it ends', () => {
    const kept = tempDir('kept');
    const gone = tempDir('gone');

    write(gone, 'node_modules/@ddd-ts-kit/kernel/index.js', 'export {};\n');
    removeTempDir(gone);

    expect(fs.existsSync(gone)).toBe(false);
    expect(fs.existsSync(kept)).toBe(true);
    expect(fs.existsSync(path.dirname(gone))).toBe(true);
  });

  it('are removed once, whatever the case already removed', () => {
    const root = tempDir('twice');

    removeTempDir(root);

    expect(() => removeTempDir(root)).not.toThrow();
    expect(fs.existsSync(root)).toBe(false);
  });
});
