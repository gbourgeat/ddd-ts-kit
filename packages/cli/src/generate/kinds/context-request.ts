import type { Upstream } from '../../config';
import type { PrerequisiteProbe } from '../generator-probe';
import type { GlossaryRow } from '../parse-terms';

export interface ContextRequest {
  readonly name: string;
  readonly classification: string | undefined;
  readonly upstreams: readonly Upstream[];
  readonly purpose?: string | undefined;
  /** Why the context is of its classification, in one sentence: the line under `## Classification`. */
  readonly classificationReason?: string | undefined;
  readonly terms?: readonly GlossaryRow[];
  /** Hears the CONTEXT.md of each upstream it declares, when `plan-waves` replays the command. */
  readonly builtOn?: PrerequisiteProbe | undefined;
}
