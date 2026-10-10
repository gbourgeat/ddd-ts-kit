/** The rules that judge a source on its own, whatever the project around it (`check --clean-only`). */
export const CLEAN_RULE_IDS: readonly string[] = [
  'clean/stepdown',
  'clean/function-size',
  'clean/no-commented-out-code',
  'clean/no-noise-comment',
  'clean/no-escape-hatch',
  'clean/no-hash-private',
  'clean/blank-lines',
  'clean/braces',
  'clean/one-export-per-file',
  'clean/file-size',
];
