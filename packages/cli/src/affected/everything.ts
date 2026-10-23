import type { Config } from '../config';
import type { Selection } from './selection';

/** The whole project: no context left out, which is what the default branch and the nightly run always get. */
export function everything(config: Config, reason: string): Selection {
  return { scope: 'all', reason, contexts: Object.keys(config.contexts), specs: ['**/*.spec.ts'], leftOut: [] };
}
