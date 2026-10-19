import { describe, expect, it } from 'vitest';
import { contractFormat } from '../src/contracts.js';
import { tempDir, write } from './helpers.js';

describe('the format the scripts write the contracts in', () => {
  it('is YAML in a directory with no config, and in a project whose config says nothing of it', () => {
    const bare = tempDir('contract-format');
    const silent = tempDir('contract-format');

    write(silent, 'ddd-ts-kit.config.json', '{}\n');

    expect(contractFormat(bare)).toBe('yaml');
    expect(contractFormat(silent)).toBe('yaml');
  });

  it('is JSON when the config of the project asks for it', () => {
    const root = tempDir('contract-format');

    write(root, 'ddd-ts-kit.config.json', JSON.stringify({ openapi: { format: 'json' } }));

    expect(contractFormat(root)).toBe('json');
  });
});
