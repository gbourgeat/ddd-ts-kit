import type { Config } from '../../config/index.js';
import type { Name } from '../../naming/index.js';
import type { ContextRequest } from './context-request.js';

/** One context to write or to wire, in the project its config describes. */
export interface ContextPlan {
  readonly config: Config;
  readonly context: Name;
  readonly request: ContextRequest;
}
