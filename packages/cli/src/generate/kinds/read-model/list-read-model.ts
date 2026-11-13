import { toName } from '../../../naming';
import { escapeRegExp } from '../../../check/text/escape-reg-exp';
import type { Workspace } from '../../../workspace';
import { applyWiring } from '../../apply-wiring';

/** A read model store to list: its context, its class and what its file is imported by. */
interface ListedStore {
  readonly context: string;
  readonly store: string;
  readonly from: string;
}

/**
 * Adds a read model store to the list the application checks when it starts: its import and its
 * entry, `['<context>', <Store>]`, and its context among those an entry may name. A class name the list already holds, the store of the same
 * name in another context, is imported under an alias that carries its context,
 * `import { KnexSummaries as ShippingKnexSummaries }`: two imports of one name would not compile.
 * A store the list already imports from that file is left as it is.
 */
export function listReadModel(ws: Workspace, list: string, { context, store, from }: ListedStore): void {
  const held = ws.read(list) ?? '';
  const name = escapeRegExp(store);

  if (new RegExp(`import \\{ ${name}(?: as \\w+)? \\} from '${escapeRegExp(from)}';`).test(held)) {
    return;
  }

  const taken = new RegExp(`\\b${name}\\b`).test(held);
  const local = taken ? `${toName(context).pascal}${store}` : store;
  const imported = taken ? `${store} as ${local}` : store;

  applyWiring(
    ws,
    list,
    `@@imports\nimport { ${imported} } from '${from}';\n@@contexts\n'${context}',\n@@read-model-tables\n['${context}', ${local}],\n`,
  );
}
