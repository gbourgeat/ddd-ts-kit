import { REFUSAL_QUALIFIERS } from '../../check/language/refusal-qualifiers';
import { CODES_FILE } from '../../context-files';
import { CliError } from '../../cli-error';
import type { Name } from '../../naming';
import { renderTemplate, type RenderContext } from '../../templating';
import { spokenInLanguage } from '../spoken-in-language';
import { named } from '../named';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { addCode, type CodeEntry } from './add-code';
import { addFactory } from './add-factory';
import { addSpecCase } from './add-spec-case';
import { codesList, type CodesList } from './codes-list';
import { namedRefusalCode } from './named-refusal-code';
import { refuseTakenClassName } from './refuse-taken-class-name';

export interface NamedRefusal {
  readonly refusal: Name;
  readonly factory: Name;
  /** The code given with `--code`. */
  readonly asked: string | undefined;
}

interface Writing extends NamedRefusal {
  readonly context: RenderContext;
}

/** The closed list of the codes of a context, as it is on disk: absent until its first refusal. */
interface CodesFile {
  readonly path: string;
  readonly listName: string;
  readonly source: string | undefined;
  readonly list: CodesList | undefined;
}

/**
 * One refusal under `"stack.refusals": "named"`: its code in the closed list of the context
 * (`<context>.codes.ts`, created when absent), its class in a file of its own, the factory
 * asked on it, and the case of that factory in its spec. Each part is written only when missing.
 * The class is named in the ubiquitous language of the context, as every class of `domain/errors/`
 * (rule language/glossary-term), the qualifiers of a refusal aside (`Invalid`, `Too`, `Already`).
 * Its words are judged after its code: a code taken or of the kit says more precisely what to rename.
 */
export function writeNamedRefusal(scope: Scope, asked: NamedRefusal): void {
  refuseTakenClassName(scope, asked.refusal);

  const codes = codesFile(scope);

  const code = namedRefusalCode(scope, {
    refusal: asked.refusal,
    file: codes.path,
    listed: codes.list?.entries ?? new Map(),
    asked: asked.asked,
  });

  spokenInLanguage(scope, asked.refusal, REFUSAL_QUALIFIERS);

  const context = vars(scope, {
    name: named(asked.refusal),
    factory: named(asked.factory),
    error: { code },
    codes: { list: codes.listName, type: `${scope.context.pascal}Code` },
  });

  writeCode(scope, codes, { key: asked.refusal.pascal, code, context });
  writeFactory(scope, `${scope.dir}/domain/errors/${asked.refusal.kebab}.error.ts`, { ...asked, context });
  writeSpecCase(scope, `${scope.dir}/test/unit/${asked.refusal.kebab}.error.spec.ts`, { ...asked, context });
}

function codesFile(scope: Scope): CodesFile {
  const listName = `${scope.context.pascal}Codes`;
  const path = `${scope.dir}/${CODES_FILE.root(scope.context.kebab)}`;
  const source = scope.ws.read(path);
  const list = source === undefined ? undefined : codesList(source, listName);

  if (source !== undefined && list === undefined) {
    throw new CliError(
      `${path} does not declare the list ${listName}.`,
      `Declare the codes of the context as \`export const ${listName} = { ... } as const;\` (rule errors/code-listed).`,
    );
  }

  return { path, listName, source, list };
}

function writeCode(scope: Scope, codes: CodesFile, entry: CodeEntry & { readonly context: RenderContext }): void {
  if (codes.source === undefined || codes.list === undefined) {
    scope.ws.create(codes.path, renderTemplate('error/codes.ts.tpl', entry.context));

    return;
  }

  const next = addCode(codes.source, codes.list, entry);

  if (next !== codes.source) {
    scope.ws.update(codes.path, next);
  }
}

function writeFactory(scope: Scope, file: string, { refusal, factory, context }: Writing): void {
  const text = renderTemplate('error/refusal-factory.ts.tpl', context).trimEnd();
  const existing = scope.ws.read(file);

  if (existing === undefined) {
    scope.ws.create(file, renderTemplate('error/refusal.ts.tpl', { ...context, error: { factory: text } }));

    return;
  }

  const next = addFactory(existing, { className: refusal.pascal, name: factory.camel, text });

  if (next === undefined) {
    throw new CliError(
      `${file} does not declare the class ${refusal.pascal}.`,
      `Name the class after its file, or add the factory ${factory.camel} by hand.`,
    );
  }

  if (next !== existing) {
    scope.ws.update(file, next);
  }
}

function writeSpecCase(scope: Scope, file: string, { refusal, factory, context }: Writing): void {
  const text = renderTemplate('error/refusal-case.spec.ts.tpl', context).trimEnd();
  const existing = scope.ws.read(file);

  if (existing === undefined) {
    scope.ws.create(file, renderTemplate('error/refusal.spec.ts.tpl', { ...context, error: { case: text } }));

    return;
  }

  const next = addSpecCase(existing, `${refusal.pascal}.${factory.camel}(`, text);

  if (next === undefined) {
    scope.ws.notes.push(`${file} has no describe block: add the case of ${refusal.pascal}.${factory.camel} by hand.`);
  } else if (next !== existing) {
    scope.ws.update(file, next);
  }
}
