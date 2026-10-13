/**
 * The `injected(..)` statements one under the other, as the layout rules of a generated project
 * want them: a statement the width broke over several lines is set apart by a blank line, before
 * and after it (`clean/blank-lines`).
 */
export function laidOutCalls(calls: readonly string[]): string {
  return calls
    .map((call, index) => {
      const apart = index > 0 && (call.includes('\n') || (calls[index - 1]?.includes('\n') ?? false));

      return apart ? `\n${call}` : call;
    })
    .join('\n');
}
