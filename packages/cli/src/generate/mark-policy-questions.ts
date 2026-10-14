import { escapeRegExp } from '../check/text/escape-reg-exp.js';
import { filesUnder } from './files-under.js';
import { askPolicyInGeneratedUseCase } from './kinds/ask-policy-in-generated-use-case.js';
import { permissionPattern } from './permission-pattern.js';
import { refinedByPolicy } from './refined-by-policy.js';
import type { Scope } from './scope.js';

const MESSAGE_FILE = /^(application\/(?:commands|queries)\/([^/]+))\/\2\.(command|query)\.ts$/;
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

/** A use case folder: its name, its message file, its handler and whether it is a command or a query. */
interface UseCase {
  readonly name: string;
  readonly message: string;
  readonly handler: string;
  readonly kind: string;
}

/**
 * When a policy of the context refines `permission`, makes the handler of every use case of the
 * context that requires it ask that policy. A command or a plain query still as the generator wrote
 * it is written again asking it; any other handler gets a `TODO(domain)` where it asks, since which element to
 * load is a decision of the business, and the authorization module refuses its result until it
 * does. A handler that already names the permission is left as it is.
 */
export function markPolicyQuestions(scope: Scope, permission: string): void {
  if (!refinedByPolicy(scope, permission)) {
    return;
  }

  const refinement = refinementOf(scope, permission);

  for (const useCase of useCasesOf(refinement.files)) {
    const asked = refinement.named.test(source(refinement, useCase.handler));

    if (asked || !requires(refinement, useCase.message)) {
      continue;
    }

    if (!askPolicyInGeneratedUseCase(scope, useCase.name, useCase.kind)) {
      mark(refinement, useCase);
    }
  }
}

function refinementOf(scope: Scope, permission: string): Refinement {
  return {
    scope,
    files: filesUnder(scope.ws, scope.dir).filter((file) => file.endsWith('.ts') && !file.startsWith('test/')),
    reference: `${scope.context.camel}Permissions['${permission}']`,
    named: permissionPattern(scope, permission),
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
      : [{ name, message: file, handler: `${folder}/${name}.handler.ts`, kind }];
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
