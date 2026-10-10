import type { FunctionShape } from './function-shape.js';

export interface MethodShape extends FunctionShape {
  readonly visibility: 'public' | 'protected' | 'private';
  readonly isStatic: boolean;
  readonly isConstructor: boolean;
  readonly isAccessor: boolean;
}
