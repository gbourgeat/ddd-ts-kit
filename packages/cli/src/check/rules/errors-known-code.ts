import { buildsThroughFactories } from '../errors/builds-through-factories';
import { codeListName } from '../errors/code-list-name';
import type { CodeReference } from '../errors/code-reference';
import { codeReferences } from '../errors/code-references';
import { codesSetIn } from '../errors/codes-set-in';
import { KIT_CODE_KEYS } from '../errors/kit-code-keys';
import { KIT_CODES_LIST } from '../errors/kit-codes-list';
import { KIT_ERROR_CODES } from '../errors/kit-error-codes';
import { readCodeList } from '../errors/read-code-list';
import { namesRefusals } from '../errors/names-refusals';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { perFile } from '../support/per-file';
import { matchingBracket } from '../text/matching-bracket';

const ERRORS_LIST = /(?<![\w$.])errors\s*:\s*\[/g;
const UNKEPT = 'A code declared and never raised is a promise the contract makes for nothing.';
const SHARED_KERNEL = 'shared-kernel';

/** A code list by its name: what each of its keys names, undefined for a key whose value is not one string literal. */
type CodeLists = ReadonlyMap<string, ReadonlyMap<string, string | undefined>>;

interface Judged {
  readonly context: string;
  readonly named: boolean;
  readonly lists: CodeLists;
  exists(code: string): boolean;
}

export const errorsKnownCode: Rule = {
  id: 'errors/known-code',
  description:
    'Under "stack.refusals": "factories" or "named", every code a route or a controller declares in `errors`, as a string or as a member of a code list (`BillingCodes.UnknownInvoice`, `KitCodes.Forbidden`), exists: a factory or an error class of its context sets it, or the <context>.codes.ts of its context lists it, a class outside the contexts does, or it is a code of the kit.',
  scope: 'project',
  run(project) {
    if (!buildsThroughFactories(project)) {
      return [];
    }

    const known = knownCodes(project);
    const named = namesRefusals(project);
    const lists = codeLists(project);

    return perFile(project, this.id, (file) => (isRouteFile(file) ? unknownCodes(file, { known, named, lists }) : []));
  },
};

interface Read {
  readonly known: Map<string, Set<string>>;
  readonly named: boolean;
  readonly lists: CodeLists;
}

/** The code list of each context and of the shared kernel, and that of the kit, by the name a route writes. */
function codeLists(project: Project): CodeLists {
  const lists = new Map<string, ReadonlyMap<string, string | undefined>>([[KIT_CODES_LIST, KIT_CODE_KEYS]]);

  for (const file of project.files.filter((candidate) => !candidate.isTest && candidate.path.endsWith('codes.ts'))) {
    const owner = listOwner(file);
    const list = owner === undefined ? undefined : readCodeList(file.scan, codeListName(owner));

    if (list !== undefined) {
      lists.set(list.name, new Map(list.entries.map(({ key, code }) => [key, code])));
    }
  }

  return lists;
}

function listOwner({ location }: SourceFile): string | undefined {
  if (location.area === 'context') {
    return location.context;
  }

  return location.area === SHARED_KERNEL ? SHARED_KERNEL : undefined;
}

/** The codes set outside the contexts (platform, shared kernel) under the key `*`, and those of each context, its code list included, under its name. */
function knownCodes(project: Project): Map<string, Set<string>> {
  const known = new Map<string, Set<string>>([['*', new Set(KIT_ERROR_CODES)]]);

  for (const file of project.files.filter((candidate) => !candidate.isTest)) {
    const owner = file.location.area === 'context' ? file.location.context : '*';
    const codes = known.get(owner) ?? new Set<string>();

    for (const { code } of codesSetIn(file)) {
      codes.add(code);
    }

    known.set(owner, codes);
  }

  return known;
}

function isRouteFile(file: SourceFile): boolean {
  return !file.isTest && /\.(?:route|controller)\.ts$/.test(file.path);
}

function unknownCodes(file: SourceFile, { known, named, lists }: Read): Finding[] {
  const { scan, location } = file;
  const context = location.area === 'context' ? location.context : '*';

  const exists = (code: string): boolean =>
    known.get('*')?.has(code) === true || known.get(context)?.has(code) === true;

  const judged = { context, named, lists, exists };

  return [...scan.code.matchAll(ERRORS_LIST)].flatMap((match) => {
    const open = match.index + match[0].length - 1;
    const close = matchingBracket(scan.code, open);

    const written = scan.strings
      .filter((literal) => literal.start > open && literal.end <= close && !exists(literal.value))
      .map((literal) => ({ line: scan.lineAt(literal.start), ...unsetCode(literal.value, judged) }));

    const referred = codeReferences(scan.code, open, close).flatMap((reference) => {
      const refused = refusedReference(reference, judged);

      return refused === undefined ? [] : [{ line: scan.lineAt(reference.start), ...refused }];
    });

    return [...written, ...referred].sort((a, b) => a.line - b.line);
  });
}

type Refused = Pick<Finding, 'message' | 'fix'>;

function unsetCode(code: string, { context, named }: Judged): Refused {
  return {
    message: `The route declares the error code "${code}", which no refusal ${context === '*' ? 'of the project' : `of the context "${context}"`} sets.`,
    fix: named ? namedFix(context) : factoriesFix(context),
  };
}

/** What is wrong with a code named by a member of a list: a list the check cannot read, a key it does not hold, or a code of another context. */
function refusedReference({ list, key }: CodeReference, judged: Judged): Refused | undefined {
  const entries = judged.lists.get(list);

  if (entries === undefined) {
    return {
      message: `The route declares \`${list}.${key}\`, and ${list} is not a code list the check reads.`,
      fix: `Name the code through the code list of its context (<context>.codes.ts), of the shared kernel, or through ${KIT_CODES_LIST} of @ddd-ts-kit/kernel; or write it as a string. ${UNKEPT}`,
    };
  }

  const code = entries.get(key);

  if (code === undefined) {
    return {
      message: `The route declares \`${list}.${key}\`, which names no code of ${list}.`,
      fix: judged.named ? namedFix(judged.context) : factoriesFix(judged.context),
    };
  }

  return judged.exists(code) ? undefined : unsetCode(code, judged);
}

function factoriesFix(context: string): string {
  return `Write the code as its factory sets it, or add the refusal: \`ddd-ts-kit generate error ${context === '*' ? '<context>' : context} <Concept> <refusal>\`. ${UNKEPT}`;
}

function namedFix(context: string): string {
  const owner = context === '*' ? 'its context' : `"${context}"`;

  return `Write the code as the code list of ${owner} (<context>.codes.ts) lists it, or add the refusal: \`ddd-ts-kit generate error ${context === '*' ? '<context>' : context} <Refusal> <factory>\`, for example \`generate error banking InsufficientFunds forAccountId\`. ${UNKEPT}`;
}
