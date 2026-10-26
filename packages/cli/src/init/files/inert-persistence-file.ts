import type { Config } from '../../config';
import type { InitFile } from './init-file';
import { platformFile } from './platform-file';

/** How each ORM opens a connection that is never used: the variant of the template of its inert persistence. */
const OPENING: Readonly<Record<string, string>> = {
  none: 'memory',
  custom: 'memory',
  drizzle: 'pooled',
  knex: 'pooled',
  prisma: 'prisma',
  typeorm: 'typeorm',
};

/** The inert persistence of the project's ORM, for what composes the application later than `init` (a service and its proof). */
export function inertPersistenceFile(config: Config): InitFile | undefined {
  const opening = OPENING[config.stack.orm];

  return opening === undefined ? undefined : platformFile(config, 'database/inert-persistence.ts', opening);
}
