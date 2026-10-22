import type { Upstream } from '../../config';
import type { GlossaryRow } from '../parse-terms';

export interface ContextRequest {
  readonly name: string;
  readonly classification: string | undefined;
  readonly upstreams: readonly Upstream[];
  readonly purpose?: string | undefined;
  readonly terms?: readonly GlossaryRow[];
}
