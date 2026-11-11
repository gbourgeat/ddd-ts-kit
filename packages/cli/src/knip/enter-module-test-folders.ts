import type { Config } from '../config';
import { isRecord } from '../config/values/is-record';
import { formatJson } from '../json/format-json';
import type { Workspace } from '../workspace';

const KNIP_FILE = 'knip.json';
/** What a test runner enters by in the test folder of a context, without the context: its fakes and its worlds. */
const ENTERED = ['test/fakes/*.ts', 'test/worlds/*.ts'];

/**
 * The fakes and the worlds a test runner of knip enters by, named in the test folder of a module
 * and of `shared/` too, one folder below the context, beside the one of the context, in a
 * config that names the latter: a fake moved into its module stays test support kept ready, not
 * an unused file. A config that is absent or not plain JSON is left as it is.
 */
export function enterModuleTestFolders(ws: Workspace, config: Config): void {
  const knip = parsed(ws.read(KNIP_FILE) ?? '');

  if (!isRecord(knip)) {
    return;
  }

  const next = Object.fromEntries(
    Object.entries(knip).map(([key, value]) => [
      key,
      isRecord(value) && Array.isArray(value['entry'])
        ? { ...value, entry: withModuleFolders(value['entry'], config.contextsDir) }
        : value,
    ]),
  );

  if (JSON.stringify(next) !== JSON.stringify(knip)) {
    ws.update(KNIP_FILE, formatJson(next));
  }
}

/** The entries, each entry of the test folder of a context followed by the same one a folder below, unless it is there. */
function withModuleFolders(entries: readonly unknown[], contextsDir: string): unknown[] {
  return entries.flatMap((entry) => {
    const below = ENTERED.filter((entered) => entry === `${contextsDir}/*/${entered}`).map(
      (entered) => `${contextsDir}/*/*/${entered}`,
    );

    return [entry, ...below.filter((added) => !entries.includes(added))];
  });
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
