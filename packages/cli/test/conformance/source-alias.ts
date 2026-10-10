import { CONFIG_FILE, parseConfig } from '../../src/config/index.js';
import { read, REPO_ROOT } from '../helpers.js';

/** The alias of the source root as the config of the example declares it (`importAlias`): the suite spells none of its own. */
export const SOURCE_ALIAS = parseConfig(JSON.parse(read(`${REPO_ROOT}/examples/scheduling`, CONFIG_FILE))).importAlias;
