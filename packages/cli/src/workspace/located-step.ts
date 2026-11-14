import { gistOf } from './gist-of';
import type { NextStep } from './next-step';
import type { TodoPlace } from './todo-place';

/** A step on a line of a file this command changed, with its whole sentence: it is written in no file. */
export function locatedStep(content: string, { file, anchor, text }: NextStep): TodoPlace {
  const at = content.split('\n').findIndex((line) => line.includes(anchor));

  return { file, line: Math.max(at, 0) + 1, gist: gistOf(text), text };
}
