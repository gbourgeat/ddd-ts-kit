/** How a bracket moves the depth of a text whose literals are blanked: nothing for any other character. */
export const BRACKET_DEPTH: Readonly<Record<string, number>> = {
  '(': 1,
  '[': 1,
  '{': 1,
  ')': -1,
  ']': -1,
  '}': -1,
};
