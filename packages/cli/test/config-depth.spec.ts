import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config/read-config';
import { CONFIG_FILE } from '../src/config/config-file';
import { tempDir, write } from './helpers';

/** A project whose config holds a list `levels` levels deep under an unknown key. */
function projectNested(levels: number): string {
  const root = tempDir('config-depth');

  write(root, CONFIG_FILE, `{"extra":${'['.repeat(levels)}${']'.repeat(levels)}}`);

  return root;
}

describe('a config nested very deep', () => {
  it('is refused with the reason, however deep, before anything prints it', () => {
    expect(() => readConfig(projectNested(200_000))).toThrow('nested more than 32 levels deep');
  });

  it('is refused one level past the limit, and read at the limit', () => {
    expect(() => readConfig(projectNested(33))).toThrow('nested more than 32 levels deep');
    expect(() => readConfig(projectNested(32))).not.toThrow();
  });
});
