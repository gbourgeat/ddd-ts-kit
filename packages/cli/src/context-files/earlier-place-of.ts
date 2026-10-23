import { CONTEXT_FILES } from './context-file';

/**
 * The path a file of a context at its root is read as, relative to the context, so that every rule
 * keeps the meaning it had in the role folder: `billing.codes.ts` is `domain/errors/codes.ts`.
 * Undefined for any other file.
 */
export function earlierPlaceOf(context: string, relative: string): string | undefined {
  return CONTEXT_FILES.find((file) => file.root(context) === relative)?.earlier(context);
}
