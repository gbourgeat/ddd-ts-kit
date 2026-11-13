import type { ClassShape } from '../check/structure/class-shape';

/** A class a source of the project declares at the level of its module, outside its tests. */
export interface DeclaredClass {
  /** Its file, from the root of the project. */
  readonly file: string;
  /** The bounded context of its file, when it is in one. */
  readonly context: string | undefined;
  readonly shape: ClassShape;
  /** Its own text, from `class` to the brace that closes it, comments and literals blanked. */
  readonly code: string;
  /** True when its file exports it as its default and not by its name. */
  readonly isDefaultOnly: boolean;
}
