import { escapeRegExp } from '../../../check/text/escape-reg-exp';
import { listingOf, type ListedStore } from '../../../read-models/listing-of';
import type { Workspace } from '../../../workspace';
import { applyWiring } from '../../apply-wiring';

/**
 * Adds a read model store to the list the application checks when it starts: its import and its
 * entry, `['<context>', <Store>]`, and its context among those an entry may name. A class name the list already holds, the store of the same
 * name in another context, is imported under an alias that carries its context,
 * `import { KnexSummaries as ShippingKnexSummaries }`: two imports of one name would not compile.
 * A store the list already imports from that file is left as it is.
 */
export function listReadModel(ws: Workspace, list: string, listed: ListedStore): void {
  const held = ws.read(list) ?? '';
  const name = escapeRegExp(listed.store);

  if (new RegExp(`import \\{ ${name}(?: as \\w+)? \\} from '${escapeRegExp(listed.from)}';`).test(held)) {
    return;
  }

  const { imported, entry } = listingOf(held, listed);

  applyWiring(ws, list, `@@imports\n${imported}\n@@contexts\n'${listed.context}',\n@@read-model-tables\n${entry}\n`);
}
