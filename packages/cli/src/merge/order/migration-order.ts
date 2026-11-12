import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../../commit/run-git';
import { CONFIG_FILE, readConfig } from '../../config';
import { drizzleOrder } from './drizzle-order';
import type { MigrationOrderFinding } from './migration-order-finding';
import { namedOrder } from './named-order';

/**
 * The migrations of the working tree that do not follow the trunk's: one the branch adds that
 * sorts before the last migration of the trunk, on the four ORM, and under drizzle-kit a file
 * the journal does not list. A working migration (`working-<what-it-does>`) is left out: its
 * place is decided when the branch lands. Nothing without the config of the kit or an ORM.
 */
export function migrationOrder(root: string, trunk: { name: string; commit: string }): MigrationOrderFinding[] {
  const orm = fs.existsSync(path.join(root, CONFIG_FILE)) ? readConfig(root).config.stack.orm : undefined;
  const merged = runGit(root, ['merge-base', '--is-ancestor', trunk.commit, 'HEAD']) !== undefined;

  if (orm === 'drizzle') {
    return drizzleOrder(root, { ...trunk, merged });
  }

  return orm === 'knex' || orm === 'prisma' || orm === 'typeorm' ? namedOrder(root, orm, { ...trunk, merged }) : [];
}
