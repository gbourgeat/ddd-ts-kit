import type { TypeOrmPersonalDataErasureOptions } from './type-orm-personal-data-erasure-options';

/** What an export reads: the copy it names, the entities of the context that hold personal data, the tenant that confines them. A file is handed over by its key, as a value. */
export type TypeOrmPersonalDataExportOptions = Pick<
  TypeOrmPersonalDataErasureOptions,
  'name' | 'declarations' | 'tenant'
>;
