import { PRISMA_SCHEMA_FOLDER } from './prisma-schema-folder';
import { SINGLE_PRISMA_SCHEMA } from './single-prisma-schema';

/** That one file, and what to do with it: what `init` says and what `generate repository` refuses with. */
export function singlePrismaSchemaFound(): string {
  return `${SINGLE_PRISMA_SCHEMA} holds the whole Prisma schema, as versions before 0.95 laid it out, where the models of each context now live in a file of their own under ${PRISMA_SCHEMA_FOLDER}/.`;
}
