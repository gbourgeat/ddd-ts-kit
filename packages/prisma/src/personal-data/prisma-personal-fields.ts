import type { ErasureMode } from '@ddd-ts-kit/kernel';
import type { PrismaPersonalTable } from './prisma-personal-table';

/** A `personalFields` declaration on a Prisma model, whatever its row type: its table, the columns by their SQL names (`@map`). */
export interface PrismaPersonalFields {
  readonly table: PrismaPersonalTable;
  readonly subject: string;
  readonly fields: readonly string[];
  readonly erasure: ErasureMode;
  readonly files: readonly string[];
}
