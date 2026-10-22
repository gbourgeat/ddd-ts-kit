import type { FunctionShape } from './function-shape';

export interface TopLevelFunction extends FunctionShape {
  readonly exported: boolean;
}
