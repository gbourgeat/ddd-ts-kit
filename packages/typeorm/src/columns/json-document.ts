/**
 * What a `jsonb` column holds, as a row type states it: TypeORM types `null` out of a column
 * typed `unknown`, which a column cleared back to SQL NULL needs.
 */
export type JsonDocument = object | string | number | boolean;
