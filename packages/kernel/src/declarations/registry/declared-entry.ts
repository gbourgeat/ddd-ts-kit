import type { Declaration } from '../model/declaration';
import type { DeclaredClass } from '../model/declared-class';

export interface DeclaredEntry {
  readonly target: DeclaredClass;
  readonly declaration: Declaration;
}
