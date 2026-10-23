import type { Config } from '../../config';
import type { Flaw } from '../model/flaw';
import { firstFlaw } from './first-flaw';

/**
 * Why the canonical tree refuses a path given relative to a context (`application/services/`),
 * judged in each of `contexts` with its extra directories: the flaw of the first one when every
 * one of them refuses it; undefined when one accepts it, or when no context is given.
 */
export function flawInContexts(relative: string, contexts: readonly string[], config: Config): Flaw | undefined {
  const flaws = contexts.map((context) => firstFlaw(`${config.contextsDir}/${context}/${relative}`, config));
  const [first] = flaws;

  return flaws.every((flaw) => flaw !== undefined) ? first : undefined;
}
