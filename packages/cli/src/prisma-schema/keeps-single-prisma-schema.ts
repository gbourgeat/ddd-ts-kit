import { PRISMA_MAIN_SCHEMA } from './prisma-main-schema';
import { SINGLE_PRISMA_SCHEMA } from './single-prisma-schema';

/**
 * Whether the project keeps its Prisma schema in one file, as versions before 0.95 laid it out:
 * the file is there and the main file of the folder is not. A folder written beside that file
 * would hold a second generator and datasource, and the move into it would find its target taken.
 */
export function keepsSinglePrismaSchema(exists: (file: string) => boolean): boolean {
  return exists(SINGLE_PRISMA_SCHEMA) && !exists(PRISMA_MAIN_SCHEMA);
}
