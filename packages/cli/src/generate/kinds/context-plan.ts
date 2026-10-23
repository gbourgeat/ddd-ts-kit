import type { Config } from '../../config';
import type { Name } from '../../naming';
import type { ContextRequest } from './context-request';

/** One context to write or to wire, in the project its config describes. */
export interface ContextPlan {
  readonly config: Config;
  readonly context: Name;
  readonly request: ContextRequest;
}
