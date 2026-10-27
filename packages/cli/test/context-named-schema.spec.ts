import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir } from './helpers';
import { initProject } from './support/init-project';

const REFUSED = '"schema" cannot name a bounded context';

describe('a bounded context named schema', () => {
  it.each(['prisma', 'drizzle', 'knex', 'typeorm', 'none'])(
    'is refused by generate context on %s, before anything is written',
    (orm) => {
      const root = initProject('--orm', orm, '--audit', 'off');
      const config = read(root, 'ddd-ts-kit.config.json');

      const refused = cli(root, 'generate', 'context', 'schema', '--classification', 'core');

      expect(refused.code).toBe(2);
      expect(refused.stderr).toContain(REFUSED);
      expect(refused.stderr).toContain('prisma/schema/schema.prisma');
      expect(read(root, 'ddd-ts-kit.config.json')).toBe(config);
      expect(exists(root, 'src/contexts/schema')).toBe(false);
    },
  );

  it('is refused by init --context, whatever its case', () => {
    const root = tempDir('init');

    const refused = cli(root, 'init', '--orm', 'prisma', '--context', 'Schema:core');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain(REFUSED);
  });

  it('leaves names that only contain the word alone', () => {
    const root = initProject('--orm', 'prisma', '--audit', 'off');

    expect(cli(root, 'generate', 'context', 'schema-registry', '--classification', 'supporting').code).toBe(0);
  });
});
