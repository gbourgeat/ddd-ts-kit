import { PRISMA_SCHEMA_FOLDER } from './prisma-schema-folder';

/** The generator of the client, the datasource and the tables of the platform (outbox, jobs, event store, audit). */
export const PRISMA_MAIN_SCHEMA = `${PRISMA_SCHEMA_FOLDER}/schema.prisma`;
