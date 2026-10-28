import type { TodoLocation } from './todo-location';

/** The step that defines the language of a context: the first thing to do, before the code. */
export function isLanguageStep(todo: TodoLocation): boolean {
  return todo.text.startsWith('define the ubiquitous language first');
}
