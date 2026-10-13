import type { SourceFile } from '../model/source-file.js';
import { nameOfEventClass } from './name-of-event-class.js';

/** The name an event class declares, found by the name of the class. */
export type EventNameResolver = (eventClass: string) => string | undefined;

/** Reads `<Event>.eventName` among these files: the name the class `<Event>` declares once. */
export function eventNameResolver(files: readonly SourceFile[]): EventNameResolver {
  const known = new Map<string, string | undefined>();

  return (eventClass) => {
    if (!known.has(eventClass)) {
      known.set(eventClass, firstName(files, eventClass));
    }

    return known.get(eventClass);
  };
}

function firstName(files: readonly SourceFile[], eventClass: string): string | undefined {
  for (const file of files) {
    const name = nameOfEventClass(file, eventClass);

    if (name !== undefined) {
      return name;
    }
  }

  return undefined;
}
