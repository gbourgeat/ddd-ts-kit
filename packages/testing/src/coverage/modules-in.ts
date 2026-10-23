import fs from 'node:fs';
import path from 'node:path';
import { contextsIn } from './contexts-in';
import { REFERENCE_COVERAGE } from './reference-coverage';

/** The folders of a context that are none of its own: its layers, its tests and its published language. */
const OF_THE_CONTEXT = [...Object.keys(REFERENCE_COVERAGE), 'published-language', 'test'];

/**
 * The modules of the model of a context, read from its directory: each folder directly in it that
 * holds a layer of its own (`calendars/domain/`), sorted. The config is not read here, as nothing
 * else of the coverage reads it.
 */
export function modulesIn(context: string): string[] {
  return contextsIn(context).filter(
    (folder) =>
      !OF_THE_CONTEXT.includes(folder) &&
      Object.keys(REFERENCE_COVERAGE).some((layer) => fs.existsSync(path.join(context, folder, layer))),
  );
}
