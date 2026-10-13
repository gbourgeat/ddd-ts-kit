import { scan } from '../check/scan/scan.js';
import { matchingBracket } from '../check/text/matching-bracket.js';
import { isConvertedCall } from './is-converted-call.js';
import { applyEdits } from './apply-edits.js';
import type { Edit } from './edit.js';
import type { ResultMethods } from './result-methods.js';
import type { Rewrite } from './rewrite.js';

const UNWRAP = /(?<![\w$.])unwrap\s*\(/g;

/** `unwrap(Email.create(raw))` becomes `Email.create(raw)`: the factory gives the value, or throws. */
export function withoutUnwrap(source: string, methods: ResultMethods): Rewrite {
  const { code } = scan(source);

  const edits = [...code.matchAll(UNWRAP)].flatMap((found): Edit[] => {
    const open = found.index + found[0].length - 1;
    const close = matchingBracket(code, open);

    if (!isConvertedCall(code, { start: open + 1, end: close }, methods)) {
      return [];
    }

    return [
      {
        start: found.index,
        end: close + 1,
        text: source
          .slice(open + 1, close)
          .trim()
          .replace(/,$/, ''),
      },
    ];
  });

  return { source: applyEdits(source, nonNested(edits)), count: nonNested(edits).length };
}

/** `unwrap(Booking.create({ slot: unwrap(Slot.create(..)) }))`: the outer one is rewritten first, the inner one on the next pass. */
function nonNested(edits: readonly Edit[]): Edit[] {
  return edits.filter(
    (edit) => !edits.some((other) => other !== edit && other.start < edit.start && edit.end <= other.end),
  );
}
