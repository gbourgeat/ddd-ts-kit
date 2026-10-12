import type { StoredData } from './stored-data.js';

/** Turns the data of a stored event from one version of its shape into the next one. Pure: the stored event is never rewritten. */
export type Upcaster = (data: StoredData) => StoredData;
