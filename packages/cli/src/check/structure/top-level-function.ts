import type { FunctionShape } from './function-shape.js';

export interface TopLevelFunction extends FunctionShape {
  readonly exported: boolean;
}
