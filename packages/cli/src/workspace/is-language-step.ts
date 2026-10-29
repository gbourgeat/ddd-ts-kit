import type { TodoPlace } from './todo-place';

/** Whether a place asks for the definition of the language, which comes before any decision of the code. */
export function isLanguageStep(place: TodoPlace): boolean {
  return place.gist.startsWith('define the ubiquitous language first');
}
