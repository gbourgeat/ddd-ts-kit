import type { Declaration } from '../model/declaration.js';
import type { DeclaredClass } from '../model/declared-class.js';

export interface DeclaredEntry {
  readonly target: DeclaredClass;
  readonly declaration: Declaration;
}
