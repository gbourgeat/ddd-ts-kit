import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, tempDir } from './helpers';

function project(...flags: string[]): string {
  const root = tempDir('other-orm');

  cli(root, 'init', ...flags);

  return root;
}

describe('a generate command of another ORM refuses before it writes anything', () => {
  it('names the ORM of a Drizzle project and the script that fits it', () => {
    const root = project();
    const result = cli(root, 'prisma-generate', '--name', 'x');

    expect(result.code).toBe(2);

    expect(result.stderr).toContain(
      'prisma-generate writes the migrations of a Prisma project, and this project uses Drizzle.',
    );

    expect(result.stderr).toContain(
      'fix: Run `pnpm run db:generate <what-it-does>`, the script of this project (`ddd-ts-kit drizzle-generate`).',
    );

    expect(fs.existsSync(path.join(root, 'prisma'))).toBe(false);
  });

  it('refuses typeorm-generate on Drizzle and drizzle-generate on TypeORM', () => {
    expect(cli(project(), 'typeorm-generate', 'x/y').stderr).toContain('this project uses Drizzle.');

    expect(cli(project('--orm', 'typeorm'), 'drizzle-generate', '--name', 'x').stderr).toContain(
      'this project uses TypeORM.',
    );
  });

  it('names the script and the command of a Knex project', () => {
    const result = cli(project('--orm', 'knex'), 'prisma-generate', '--name', 'x');

    const fix =
      'fix: Run `pnpm run db:generate <what-it-does>`, the script of this project (`ddd-ts-kit knex-generate`).';

    expect(result.stderr).toContain('this project uses Knex.');
    expect(result.stderr).toContain(fix);
  });

  it('refuses knex-generate on a Drizzle project before it writes anything', () => {
    const root = project();
    const before = fs.readdirSync(path.join(root, 'migrations'));
    const result = cli(root, 'knex-generate', '--name', 'x');
    const refusal = 'knex-generate writes the migrations of a Knex project, and this project uses Drizzle.';

    expect(result.code).toBe(2);
    expect(result.stderr).toContain(refusal);
    expect(fs.readdirSync(path.join(root, 'migrations'))).toEqual(before);
  });

  it('says there is nothing to generate on a project without a database', () => {
    expect(cli(project('--orm', 'none'), 'typeorm-generate', 'x/y').stderr).toContain(
      'has no migration for the kit to generate',
    );
  });
});
