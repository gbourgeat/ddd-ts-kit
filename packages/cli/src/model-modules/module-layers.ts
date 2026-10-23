/** The four layers a module of the model holds, each with its role folders unchanged below it. */
export const MODULE_LAYERS: readonly string[] = ['domain', 'application', 'infrastructure', 'presentation'];

/** The layers 0.86 put a module under (`domain/<module>/`), still read for one minor version. */
export const EARLIER_MODULE_LAYERS: readonly string[] = ['domain', 'application'];

/** The folders of `test/` whose specs follow the module of their subject: `test/unit/<module>/`. */
export const MODULE_TEST_FOLDERS: readonly string[] = ['unit', 'integration'];

/** What a module can never be named: a layer, a folder of the root of a context. */
export const CONTEXT_FOLDERS: readonly string[] = [...MODULE_LAYERS, 'published-language', 'test'];
