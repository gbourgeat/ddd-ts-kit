import type { DrizzlePersonalDataErasureOptions } from './drizzle-personal-data-erasure-options';

/** What an export reads: the copy it names, the tables of the context that hold personal data, the tenant that confines them. A file is handed over by its key, as a value. */
export type DrizzlePersonalDataExportOptions = Pick<
  DrizzlePersonalDataErasureOptions,
  'name' | 'declarations' | 'tenant'
>;
