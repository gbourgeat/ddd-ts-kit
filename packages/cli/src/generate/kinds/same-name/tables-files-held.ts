import type { Config } from '../../../config';
import { readModule } from './read-module';
import type { FileReader } from './sources-of';
import { placesOf } from './places-of';

/**
 * Every place a commit holds a tables file of a context at, in the order the kit reads them: its
 * modules, `shared/`, then flat. A file counts when it declares a value of its own: one that only
 * re-exports another place of the context, or holds nothing, is that other place, or nothing.
 */
export function tablesFilesHeld(config: Config, read: FileReader, context: string): string[] {
  return placesOf(config, context).filter((place) => {
    const text = read(place);

    return text !== undefined && readModule(text).values.length > 0;
  });
}
