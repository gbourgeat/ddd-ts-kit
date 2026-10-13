import { isStoredData } from '../../application/event-sourcing/is-stored-data.js';
import type { StoredData } from '../../application/event-sourcing/stored-data.js';
import type { StoredJson } from '../../application/event-sourcing/stored-json.js';

/** Answers what replaces an object of the data, or `undefined` to keep it and look inside. */
type Rewrite = (object: StoredData) => Promise<StoredJson> | undefined;

/** A copy of the data where `rewrite` replaced the objects it recognised, at any depth. */
export async function rewriteObjects(data: StoredData, rewrite: Rewrite): Promise<StoredData> {
  const entries = await Promise.all(
    Object.entries(data).map(async ([key, value]) => [key, await rewritten(value, rewrite)] as const),
  );

  return Object.fromEntries(entries);
}

async function rewritten(value: StoredJson, rewrite: Rewrite): Promise<StoredJson> {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item: StoredJson) => rewritten(item, rewrite)));
  }

  if (!isStoredData(value)) {
    return value;
  }

  return (await rewrite(value)) ?? rewriteObjects(value, rewrite);
}
