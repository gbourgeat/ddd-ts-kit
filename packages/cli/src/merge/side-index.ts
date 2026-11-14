import type { Config } from '../config';
import { type IndexReading, readIndex } from '../generate/kinds/same-name/index-reading';
import type { FileReader } from '../generate/kinds/same-name/sources-of';
import type { Workspace } from '../workspace';
import { movedTablesFiles } from './moved-tables-files';
import { sideTablesFile } from './side-tables-file';

/**
 * The schema index of one side of a merge, read as that side's commit lays its contexts out, then
 * written in the layout of the merged tree. The tables file of a context is found where that
 * commit holds it, flat or in `shared/` or a module of the context; what it declares is then
 * named by the file the merged tree holds for that context, so that a table is the same table on
 * both sides when one side laid its context out in modules. Any other module keeps its path.
 */
export function sideIndex(ws: Workspace, config: Config, read: FileReader): IndexReading {
  const index = `${config.platformDir}/database/schema.ts`;
  const reading = readIndex(config, { index, read, tablesFile: (context) => sideTablesFile(config, read, context) });
  const moved = movedTablesFiles(ws, config, read);

  return moved.size === 0 ? reading : inTheMergedLayout(reading, moved);
}

/** A reading whose files and origins are those of the merged tree, where a context's tables file moved. */
function inTheMergedLayout(reading: IndexReading, moved: ReadonlyMap<string, string>): IndexReading {
  const file = (path: string): string => moved.get(path) ?? path;

  const origin = (value: string): string => {
    const at = value.lastIndexOf('#');

    return at < 0 ? value : `${file(value.slice(0, at))}${value.slice(at)}`;
  };

  const star = <Star extends IndexReading['stars'][number]>(held: Star): Star => ({
    ...held,
    file: file(held.file),
    symbols: held.symbols.map((symbol) => ({ ...symbol, origin: origin(symbol.origin) })),
  });

  return {
    ...reading,
    given: reading.given.map((given) => ({
      ...given,
      ...(given.file === undefined ? {} : { file: file(given.file) }),
      ...(given.value === undefined ? {} : { value: origin(given.value) }),
      ...(given.type === undefined ? {} : { type: origin(given.type) }),
    })),
    stars: reading.stars.map(star),
    tables: reading.tables.map(star),
  };
}
