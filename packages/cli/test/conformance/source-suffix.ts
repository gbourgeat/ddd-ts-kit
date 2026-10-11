import { specifierSuffix } from '../../src/alias/index.js';
import { CONFIG_FILE, parseConfig } from '../../src/config/index.js';
import { read, REPO_ROOT } from '../helpers.js';

/** What an import of the example ends with, as its config says (`importExtension`): the suite spells none of its own. */
export const SOURCE_SUFFIX = specifierSuffix(
  parseConfig(JSON.parse(read(`${REPO_ROOT}/examples/scheduling`, CONFIG_FILE))).importExtension,
);
