import { codeListName } from '../check/errors/code-list-name';
import { KIT_CODE_KEYS } from '../check/errors/kit-code-keys';
import { KIT_CODES_LIST } from '../check/errors/kit-codes-list';
import { readCodeList } from '../check/errors/read-code-list';
import { scan } from '../check/scan/scan';
import { CODES_FILE, contextFileAt } from '../context-files';
import type { ContextSources } from './context-sources';

const SHARED_KERNEL = 'shared-kernel';
const MEMBER = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/;

/**
 * The code an entry of an `errors` list stands for, in the context given: a member of its code
 * list, of that of the shared kernel or of the kit (`BillingCodes.UnknownInvoice`,
 * `KitCodes.Forbidden`) gives the code it names; anything else stays as it is written.
 */
export function codesNamedIn(sources: ContextSources): (entry: string) => string {
  const { ws, config, directory, name } = sources;
  const own = contextFileAt(CODES_FILE, name, (relative) => ws.exists(`${directory}/${relative}`));

  const lists = new Map<string, ReadonlyMap<string, string | undefined>>([
    [KIT_CODES_LIST, KIT_CODE_KEYS],
    listOf(ws.read(`${directory}/${own}`), name),
    listOf(ws.read(`${config.sharedKernelDir}/${SHARED_KERNEL}.codes.ts`), SHARED_KERNEL),
  ]);

  return (entry) => {
    const [, list = '', key = ''] = MEMBER.exec(entry) ?? [];

    return lists.get(list)?.get(key) ?? entry;
  };
}

/** The list `owner` declares in the text of its codes file, by its name; empty without the file or the list. */
function listOf(text: string | undefined, owner: string): [string, ReadonlyMap<string, string | undefined>] {
  const listName = codeListName(owner);
  const list = readCodeList(scan(text ?? ''), listName);

  return [listName, new Map((list?.entries ?? []).map(({ key, code }) => [key, code]))];
}
