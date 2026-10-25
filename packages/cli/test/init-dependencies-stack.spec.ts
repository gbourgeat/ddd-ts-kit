import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUTHN_STACKS,
  BROKER_STACKS,
  DATABASE_STACKS,
  DI_STACKS,
  ERROR_REPORTERS,
  HTTP_STACKS,
  LOGGERS,
  ORM_STACKS,
  STORAGE_STACKS,
  TEST_STACKS,
  VALIDATION_STACKS,
  type Stack,
} from '../src/config';
import { CLUES } from '../src/init/manifest/dependencies-against-stack';
import { cli, tempDir, write } from './helpers';
import { stringsAt } from './support/strings-at';

const VALUES: Partial<Record<keyof Stack, readonly string[]>> = {
  http: HTTP_STACKS,
  validation: VALIDATION_STACKS,
  di: DI_STACKS,
  tests: TEST_STACKS,
  orm: ORM_STACKS,
  database: DATABASE_STACKS,
  broker: BROKER_STACKS,
  authn: AUTHN_STACKS,
  logger: LOGGERS,
  errors: ERROR_REPORTERS,
  storage: STORAGE_STACKS,
};

const FASTIFY_PRISMA_JEST = {
  name: 'legacy-shop',
  dependencies: { fastify: '^5.0.0', '@prisma/client': '^6.0.0', zod: '^4.0.0' },
  devDependencies: { prisma: '^6.0.0', jest: '^30.0.0' },
};

describe('init in a project whose dependencies already say its stack', () => {
  it('reads each dependency as a value its key accepts', () => {
    for (const clue of CLUES) {
      expect(
        Object.values(clue.packages).filter((value) => !VALUES[clue.key]?.includes(value)),
        clue.flag,
      ).toEqual([]);
    }
  });

  it('names, in a dry run that writes nothing, the flag of each dependency the stack would contradict', () => {
    const root = adopted(FASTIFY_PRISMA_JEST);

    const notes = notesOf(root, 'init', '--dry-run');

    expect(notes).toContain(
      'package.json depends on fastify, and the project is written for --http express: pass --http fastify to keep it.',
    );

    expect(notes).toContain(
      'package.json depends on @prisma/client and prisma, and the project is written for --orm drizzle: pass --orm prisma to keep it.',
    );

    expect(notes).toContain(
      'package.json depends on jest, and the project is written for --tests vitest: pass --tests jest to keep it.',
    );

    expect(notes).not.toContain('--validation');
    expect(fs.existsSync(path.join(root, 'ddd-ts-kit.config.json'))).toBe(false);
  });

  it('says nothing once the flags keep what the project runs on', () => {
    const root = adopted(FASTIFY_PRISMA_JEST);

    const notes = notesOf(root, 'init', '--dry-run', '--http', 'fastify', '--orm', 'prisma', '--tests', 'jest');

    expect(notes).not.toContain('package.json depends on');
  });

  it('leaves to the owner a key two dependencies answer differently', () => {
    const root = adopted({ name: 'two-frameworks', dependencies: { express: '^5.0.0', fastify: '^5.0.0' } });

    expect(notesOf(root, 'init', '--dry-run', '--http', 'hono')).toContain(
      'package.json depends on express and fastify: --http says which one the project is written for (hono now, without the flag).',
    );
  });

  it('reads the dependencies only when the project is initialised for the first time', () => {
    const root = adopted(FASTIFY_PRISMA_JEST);

    cli(root, 'init', '--http', 'fastify', '--orm', 'prisma', '--tests', 'jest');

    expect(notesOf(root, 'init', '--dry-run')).not.toContain('package.json depends on');
  });
});

function adopted(manifest: object): string {
  const root = tempDir('init-dependencies');

  write(root, 'package.json', JSON.stringify(manifest));

  return root;
}

function notesOf(root: string, ...args: string[]): string {
  return stringsAt(cli(root, ...args, '--json').json(), 'notes').join('\n');
}
