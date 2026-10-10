/**
 * The rule of the architecture reference a formatter holds: this checker writes no formatter of
 * its own, it only knows the id so that the listing and `explain` can say who decides.
 */
export const FORMATTER_RULE = {
  id: 'clean/formatted',
  description:
    'Every TypeScript, JavaScript and JSON file is laid out by the formatter of the project, Biome, at a line width of 120: the format check reports nothing to change.',
} as const;
