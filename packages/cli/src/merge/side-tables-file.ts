import type { Config } from '../config';
import type { FileReader } from '../generate/kinds/same-name/sources-of';
import { placesOf } from '../generate/kinds/same-name/places-of';
import { tablesFilesHeld } from '../generate/kinds/same-name/tables-files-held';

/** The tables file of a context as a commit holds it: the first place that declares a value, else the first it has, else its flat place. */
export function sideTablesFile(config: Config, read: FileReader, context: string): string {
  const places = placesOf(config, context);

  return (
    tablesFilesHeld(config, read, context)[0] ??
    places.find((place) => read(place) !== undefined) ??
    `${config.contextsDir}/${context}/infrastructure/persistence/${context}.schema.ts`
  );
}
