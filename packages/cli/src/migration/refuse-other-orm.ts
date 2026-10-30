import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import { CONFIG_FILE, readConfig } from '../config';

type MigratedOrm = 'drizzle' | 'prisma' | 'typeorm';

const NAMES: Readonly<Record<string, string>> = {
  drizzle: 'Drizzle',
  prisma: 'Prisma',
  typeorm: 'TypeORM',
  knex: 'Knex',
  custom: 'a storage of its own',
  none: 'no database',
};

/**
 * The `*-generate` commands write the migrations of one ORM. Run in a project of another, they
 * refuse before anything is written, and say which ORM the project uses and the script that fits it.
 */
export function refuseOtherOrm(root: string, command: MigratedOrm): void {
  const orm = ormOfProject(root);

  if (orm === undefined || orm === command) {
    return;
  }

  const uses = NAMES[orm] ?? orm;

  throw new CliError(
    `${command}-generate writes the migrations of a ${NAMES[command]} project, and this project uses ${uses}.`,
    orm === 'none' || orm === 'custom'
      ? `A project with ${uses} has no migration for the kit to generate: drop ${command}-generate.`
      : `Run \`npm run db:generate <what-it-does>\`, the script of this project${orm === 'knex' ? '' : ` (\`ddd-ts-kit ${orm}-generate\`)`}.`,
  );
}

/** The ORM the config records, or nothing when there is no config to say it. */
function ormOfProject(root: string): string | undefined {
  if (!fs.existsSync(path.join(root, CONFIG_FILE))) {
    return undefined;
  }

  return readConfig(root).config.stack.orm;
}
