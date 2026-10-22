import { TECHNICAL_WORDS } from '../language/technical-words.js';

/**
 * Words that name a bag, not a part of the model: a module called `shared`, `common` or `core`
 * becomes the place where everything else goes, which is what modules are there to avoid.
 */
export const MODULE_TECHNICAL_WORDS: readonly string[] = [
  ...TECHNICAL_WORDS,
  'shared',
  'common',
  'core',
  'misc',
  'general',
  'other',
  'main',
  'default',
  'lib',
  'stuff',
];
