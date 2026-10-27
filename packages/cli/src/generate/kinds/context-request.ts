import type { Upstream } from '../../config';
import type { GlossaryRow } from '../parse-terms';

export interface ContextRequest {
  readonly name: string;
  readonly classification: string | undefined;
  readonly upstreams: readonly Upstream[];
  readonly purpose?: string | undefined;
  /** Why the context is of its classification, in one sentence: the line under `## Classification`. */
  readonly classificationReason?: string | undefined;
  readonly terms?: readonly GlossaryRow[];
}
