import type { Resolve } from '../wiring/resolve.js';

export interface ModuleContext {
  readonly resolve: Resolve;
}
