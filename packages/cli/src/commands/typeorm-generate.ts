import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import { readConfig } from '../config';
import {
  ensureDatabaseReachable,
  formatAsTheProject,
  generateGuarded,
  runOrmTool,
  schemasFirst,
  typeOnlyImports,
} from '../migration';
import { Arguments } from './arguments';
import type { Command } from './command';

/**
 * `db:generate` of a TypeORM project: `typeorm migration:generate` on the compiled data source of
 * the platform, then, with an audit trail, the statements that make it append-only at the end of
 * the `up` of the migration that creates it; the schemas of its tables are created first, which
 * TypeORM does not write, and the migration is brought to the rules of the project (type-only
 * imports, its formatter), since the build compiles it into `dist/migrations`.
 */
export const typeormGenerateCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const root = args.projectRoot;
  const [target] = args.positionals;

  if (target === undefined || target.trim() === '') {
    throw new CliError(
      'A migration is named by where it goes and what it does.',
      'Run `npm run db:generate migrations/<what-it-does>`, for example `npm run db:generate migrations/add-invoices`.',
    );
  }

  ensureDatabaseReachable();

  const dataSource = `dist/${readConfig(root).config.platformDir}/database/data-source.js`;

  return generateGuarded(
    {
      root,
      orm: 'typeorm',
      folder: path.posix.dirname(target),
      migration: /\.ts$/,
      generate: () => runOrmTool(root, 'typeorm/cli.js', ['migration:generate', '-d', dataSource, target]),
      tidy: (written) => {
        for (const file of written) {
          const full = path.join(root, file);

          fs.writeFileSync(full, schemasFirst(typeOnlyImports(fs.readFileSync(full, 'utf8'))));
        }

        formatAsTheProject(root, written, io);
      },
    },
    io,
  );
};
