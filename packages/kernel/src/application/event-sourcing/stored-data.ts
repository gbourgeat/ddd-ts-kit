import type { StoredJson } from './stored-json';

/** The data of a stored event or snapshot: a JSON object. */
export type StoredData = { readonly [key: string]: StoredJson };
