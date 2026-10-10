import type { Scan } from '../scan/scan.js';
import { classesOf } from './classes-of.js';
import type { DeclaredClass } from './declared-class.js';
import type { Decoration } from './decoration.js';

/** The exported classes of a source that carry one of `decorators`, with that decoration. */
export function declaredAs(
  scan: Scan,
  decorators: readonly string[],
): { readonly declared: DeclaredClass; readonly decoration: Decoration }[] {
  return classesOf(scan).flatMap((declared) => {
    const decoration = declared.exported
      ? declared.decorations.find(({ name }) => decorators.includes(name))
      : undefined;

    return decoration === undefined ? [] : [{ declared, decoration }];
  });
}
