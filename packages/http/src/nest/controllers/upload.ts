import { injectedParameter } from './injected-parameter';

/**
 * The file of a route whose `@KitRoute` declares `upload`, as the kit streams it: its size and its
 * media type checked against the declaration while it is read, never a file Nest parsed.
 */
export function Upload(): (target: object, method: string | symbol | undefined, index: number) => void {
  return injectedParameter('upload');
}
