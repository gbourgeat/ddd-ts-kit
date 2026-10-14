import { escapeRegExp } from '../check/text/escape-reg-exp.js';
import { filesUnder } from './files-under.js';
import type { Scope } from './scope.js';

const MESSAGE_FILE = /^(application\/(?:commands|queries)\/([^/]+))\/\2\.(command|query)\.ts$/;
const POLICY_FILE = /^application\/authorization\/[^/]+\.policy\.ts$/;
const MESSAGE_CLASS = /(?<![\w$.])export\s+class\s+([\w$]+)/;
const EXECUTE = /^([ \t]*)(?:public\s+)?async\s+execute\s*\([^)]*\)[^{\n]*\{[ \t]*$/m;

/** The sources of one context and the permission a policy of it refines, as the generator sees them. */
interface Refinement {
  readonly scope: Scope;
  /** Production sources of the context, relative to its directory. */
  readonly files: readonly string[];
  readonly reference: string;
  readonly named: RegExp;
}

/** A use case folder: its message file, its handler and whether it is a command or a query. */
interface UseCase {
  readonly message: string;
  readonly handler: string;
  readonly kind: string;
}

/**
 * When a policy of the context refines `permission`, marks, in the handler of every use case of
 * the context that requires it, where it asks that policy: a `TODO(domain)`, since which element
 * to load is a decision of the business. A handler that already names the permission is left as
 * it is. Run by the policy and by the use cases, whichever comes second finds the other.
 */
export function markPolicyQuestions(scope: Scope, permission: string): void {
  const refinement = refinementOf(scope, permission);

  if (!refinement.files.some((file) => POLICY_FILE.test(file) && refinement.named.test(source(refinement, file)))) {
    return;
  }

  for (const useCase of useCasesOf(refinement.files)) {
    if (requires(refinement, useCase.message)) {
      mark(refinement, useCase);
    }
  }
}

function refinementOf(scope: Scope, permission: string): Refinement {
  const set = `${scope.context.camel}Permissions`;

  return {
    scope,
    files: filesUnder(scope.ws, scope.dir).filter((file) => file.endsWith('.ts') && !file.startsWith('test/')),
    reference: `${set}['${permission}']`,
    named: new RegExp(`${escapeRegExp(set)}\\s*\\[\\s*['"\`]${escapeRegExp(permission)}['"\`]\\s*\\]`),
  };
}

function source({ scope }: Refinement, file: string): string {
  return scope.ws.read(`${scope.dir}/${file}`) ?? '';
}

function useCasesOf(files: readonly string[]): UseCase[] {
  return files.flatMap((file) => {
    const [, folder, name, kind] = MESSAGE_FILE.exec(file) ?? [];

    return folder === undefined || name === undefined || kind === undefined
      ? []
      : [{ message: file, handler: `${folder}/${name}.handler.ts`, kind }];
  });
}

/** `@Requires(<permission>)` on the message, or its registration with the permission in a module of the context. */
function requires(refinement: Refinement, message: string): boolean {
  const text = source(refinement, message);
  const name = MESSAGE_CLASS.exec(text)?.[1];

  if (name === undefined) {
    return false;
  }

  if (refinement.named.test(text)) {
    return true;
  }

  const registered = new RegExp(
    `(?:\\.\\s*(?:command|query)\\s*\\(\\s*${escapeRegExp(name)}\\s*\\)\\s*\\.\\s*requires\\s*\\(|(?<![\\w$.])requires\\s*\\(\\s*${escapeRegExp(name)}\\s*,)\\s*${refinement.named.source}`,
  );

  return refinement.files.some((file) => !MESSAGE_FILE.test(file) && registered.test(source(refinement, file)));
}

function mark(refinement: Refinement, { handler, kind }: UseCase): void {
  const { scope, reference, named } = refinement;
  const text = source(refinement, handler);
  const execute = named.test(text) ? null : EXECUTE.exec(text);

  if (execute === null) {
    return;
  }

  const anchor = `// TODO(domain): a policy refines ${reference}: load the element this ${kind} acts on, then ask it before the change, \`await this.access.authorize(${kind}.actor, ${reference}, <element>)\`, the element named after its concept and \`Access\` of @ddd-ts-kit/auth received in the constructor.`;
  const end = execute.index + execute[0].length;
  const file = `${scope.dir}/${handler}`;

  scope.ws.update(file, `${text.slice(0, end)}\n${execute[1] ?? ''}  ${anchor}${text.slice(end)}`);
  scope.ws.step({ file, anchor, text: `ask the policy of ${reference} once the element is loaded.` });
}
