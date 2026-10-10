import type { Upstream } from '../../config/index.js';
import type { GlossaryRow } from '../parse-terms.js';

export interface ContextRequest {
  readonly name: string;
  readonly classification: string | undefined;
  readonly upstreams: readonly Upstream[];
  readonly purpose?: string | undefined;
  readonly terms?: readonly GlossaryRow[];
}
