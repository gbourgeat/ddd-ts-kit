import { TECHNICAL_WORDS } from '../check/language/technical-words';
import { splitWords } from '../naming';
import { isRoleFolder } from './is-role-folder';
import { CONTEXT_FOLDERS, MODULE_LAYERS } from './module-layers';

/**
 * Words that name a bag, not a part of the model: a module called `shared`, `common` or `core`
 * becomes the place where everything else goes, which is what modules are there to avoid.
 */
const MODULE_TECHNICAL_WORDS: readonly string[] = [
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
  'platform',
];

const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Why a name cannot name a module of the model, whatever its context; undefined when it can. */
export type ModuleNameFlaw =
  | { readonly reason: 'format' }
  | { readonly reason: 'role-folder' }
  | { readonly reason: 'technical'; readonly word: string };

/**
 * The one judgement of a module name that the config check, the rule module/declared and
 * `generate module` share: a folder name in kebab-case, never the name of a layer, of a folder of the
 * root of a context or of a role folder, never a technical grouping. Whether its words are terms of the glossary depends on the context.
 */
export function moduleNameFlaw(name: string): ModuleNameFlaw | undefined {
  if (!KEBAB.test(name)) {
    return { reason: 'format' };
  }

  if (CONTEXT_FOLDERS.includes(name) || MODULE_LAYERS.some((layer) => isRoleFolder(layer, name))) {
    return { reason: 'role-folder' };
  }

  const word = splitWords(name).find((candidate) => MODULE_TECHNICAL_WORDS.includes(candidate));

  return word === undefined ? undefined : { reason: 'technical', word };
}
