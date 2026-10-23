import { specifierSuffix } from '../../src/alias';
import { CONFIG_FILE, parseConfig } from '../../src/config';
import { read, REPO_ROOT } from '../helpers';

/** What an import of the example ends with, as its config says (`importExtension`): the suite spells none of its own. */
export const SOURCE_SUFFIX = specifierSuffix(
  parseConfig(JSON.parse(read(`${REPO_ROOT}/examples/scheduling`, CONFIG_FILE))).importExtension,
);
