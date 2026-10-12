/** Types of the language and of its standard library: they exist for every program, so they name no dependency of one. */
export const LANGUAGE_TYPES: ReadonlySet<string> = new Set([
  'Date',
  'Map',
  'Set',
  'Array',
  'ReadonlyArray',
  'Record',
  'Promise',
  'Function',
  'RegExp',
  'Error',
  'URL',
  'Buffer',
  'Partial',
  'Readonly',
  'Pick',
  'Omit',
]);
