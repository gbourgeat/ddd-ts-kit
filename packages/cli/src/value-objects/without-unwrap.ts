import { scan } from '../check/scan/scan';
import { matchingBracket } from '../check/text/matching-bracket';
import { isConvertedCall } from './is-converted-call';
import { applyEdits } from './apply-edits';
import type { Edit } from './edit';
import type { ResultMethods } from './result-methods';
import type { Rewrite } from './rewrite';

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
