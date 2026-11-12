import type { PrismaRawCommands } from '../personal-data/prisma-raw-commands';

/** What an advisory lock needs of a `PrismaContext`, whatever its generated client. */
export interface PrismaLockingContext {
  client(): PrismaRawCommands;
  inTransaction(): boolean;
}
