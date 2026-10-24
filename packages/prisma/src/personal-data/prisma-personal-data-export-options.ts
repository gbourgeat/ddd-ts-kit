import type { PrismaPersonalDataErasureOptions } from './prisma-personal-data-erasure-options';

/** What an export reads: the copy it names, the tables of the context that hold personal data, the tenant that confines them. A file is handed over by its key, as a value. */
export type PrismaPersonalDataExportOptions = Pick<
  PrismaPersonalDataErasureOptions,
  'name' | 'declarations' | 'tenant'
>;
