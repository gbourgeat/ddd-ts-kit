import { loadSourceFile } from '../../../check/project/load-source-file';
import { escapeRegExp } from '../../../check/text/escape-reg-exp';
import type { Config } from '../../../config';
import { listingOf, type ListedStore } from '../../../read-models/listing-of';
import { readModelListOf } from '../../../read-models/read-model-list-of';
import type { Workspace } from '../../../workspace';
import { applyWiring } from '../../apply-wiring';

/**
 * Adds a read model store to the list the application checks when it starts: its import and its
 * entry, `['<context>', <Store>]`, and its context among those an entry may name. A class name the list already binds, the store of the same
 * name in another context, is imported under an alias that carries its context,
 * `import { KnexSummaries as ShippingKnexSummaries }`: two imports of one name would not compile.
 * A store the list already imports from that file is left as it is.
 */
export function listReadModel(ws: Workspace, config: Config, listed: ListedStore): void {
  const list = `${config.platformDir}/database/read-model-tables.ts`;
  const held = ws.read(list) ?? '';
  const name = escapeRegExp(listed.store);

  if (new RegExp(`import \\{ ${name}(?: as \\w+)? \\} from '${escapeRegExp(listed.from)}';`).test(held)) {
    return;
  }

  const { imports } = readModelListOf(config, loadSourceFile(config, list, held));
  const { imported, entry } = listingOf(imports, listed);

  applyWiring(ws, list, `@@imports\n${imported}\n@@contexts\n'${listed.context}',\n@@read-model-tables\n${entry}\n`);
}
