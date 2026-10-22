import type { Resolve } from '../wiring/resolve';

export interface ModuleContext {
  readonly resolve: Resolve;
}
