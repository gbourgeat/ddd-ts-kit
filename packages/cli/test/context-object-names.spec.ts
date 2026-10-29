import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir } from './helpers';
import { initProject } from './support/init-project';

const OBJECT_NAMES = ['constructor', 'prototype', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];

describe('a bounded context named after what every JavaScript object has', () => {
  it.each(OBJECT_NAMES)('is refused by generate context as %s, with the reason, before anything is written', (name) => {
    const root = initProject('--audit', 'off');
    const config = read(root, 'ddd-ts-kit.config.json');

    const refused = cli(root, 'generate', 'context', name, '--classification', 'core');

    expect(refused.code).toBe(2);

    expect(refused.stderr).toContain(
      `error: "${name}" cannot name a bounded context: ${name} is a name every JavaScript object has`,
    );

    expect(read(root, 'ddd-ts-kit.config.json')).toBe(config);
    expect(exists(root, `src/contexts/${name}`)).toBe(false);
  });

  it.each(OBJECT_NAMES)('is refused by init --context as %s, a dry run included, in JSON under --json', (name) => {
    const refused = cli(tempDir('init'), 'init', '--context', `${name}:core`, '--dry-run', '--json');

    expect(refused.code).toBe(2);

    expect(refused.json()).toMatchObject({
      error: { message: expect.stringContaining('cannot name a bounded context') },
    });
  });

  it('is an unknown context to the commands that read one, not the prototype of the config', () => {
    const root = initProject('--context', 'billing:core', '--audit', 'off');

    for (const name of OBJECT_NAMES) {
      const described = cli(root, 'describe', name);
      const upstream = cli(root, 'generate', 'context', 'shipping', '--classification', 'core', '--upstream', name);

      expect(described.code).toBe(2);
      expect(described.stderr).toContain(`error: Unknown context "${name}".`);
      expect(upstream.code).toBe(2);
      expect(upstream.stderr).toContain('is not declared.');
    }
  });
});
