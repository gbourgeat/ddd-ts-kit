import { CliError } from '../../cli-error';
import type { Name } from '../../naming';
import { renderTemplate, type RenderContext } from '../../templating';
import { concept } from '../concept';
import { addFactory } from '../errors/add-factory';
import { addSpecCase } from '../errors/add-spec-case';
import { codesOfContext } from '../errors/codes-of-context';
import { refusalCode } from '../errors/refusal-code';
import { refusalClassName } from '../errors/refusal-class-name';
import { refusalFactoryName } from '../errors/refusal-factory-name';
import { refusalName } from '../errors/refusal-name';
import { writeNamedRefusal } from '../errors/write-named-refusal';
import type { Kind, KindRequest } from '../kind';
import { learnTerms } from '../learn-terms';
import { named } from '../named';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { vars } from '../vars';

interface Refusal {
  readonly concept: Name;
  readonly refusal: Name;
  readonly code: string;
}

export const errorKind: Kind = {
  name: 'error',
  aliases: ['refusal'],
  usage: 'error <context|shared-kernel> <Refusal> <factory> [--code CODE] [--term "<Term>=<meaning>"]...',
  summary:
    'A refusal: under "stack.refusals": "named", its class, its code in <context>.codes.ts and a static factory, each created when absent, and its spec case; under factories or classes, `<Concept> <refusal>` adds a static factory to the error class of a concept. With shared-kernel, the refusal of a value object of the shared kernel, at its root.',
  positionals: ['context', 'Refusal', 'factory'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request, { sharedKernel: true });

    learnTerms(scope);

    if (request.config.stack.refusals === 'named') {
      writeNamedRefusal(scope, {
        refusal: refusalClassName(request.args[1] ?? '', scope.flags.allowName),
        factory: refusalFactoryName(request.args[2] ?? ''),
        asked: request.flags.code,
      });

      return;
    }

    writeConceptRefusal(scope, request);
  },
};

/** One refusal as a static factory of the error class of a concept: the form of `factories` and `classes`. */
function writeConceptRefusal(scope: Scope, request: KindRequest): void {
  const name = concept(scope, request.args[1] ?? '', { what: 'error class', strip: ['error'] });
  const refusal = refusalName(request.args[2] ?? '');
  const asked = { concept: name, refusal, code: refusalCode({ concept: name, refusal }, request.flags.code) };
  const file = `${scope.dir}/domain/errors/${name.kebab}.error.ts`;

  if (!hasFactory(scope, file, asked)) {
    refuseTakenCode(scope, asked);
  }

  const context = vars(scope, { name: named(name), refusal: named(refusal), error: { code: asked.code } });

  writeFactory(scope, file, { ...asked, context });
  writeSpecCase(scope, `${scope.dir}/test/unit/${name.kebab}.error.spec.ts`, { ...asked, context });
}

/** Run again, the command finds its factory and changes nothing: its code is its own, not one already taken. */
function hasFactory(scope: Scope, file: string, { refusal }: Refusal): boolean {
  return new RegExp(`\\bstatic\\s+${refusal.camel}\\s*[(<]`).test(scope.ws.read(file) ?? '');
}

function refuseTakenCode(scope: Scope, { concept: owner, refusal, code }: Refusal): void {
  const taken = codesOfContext(scope).get(code);

  if (taken !== undefined) {
    throw new CliError(
      `The code "${code}" is already set in ${taken}.`,
      `Call the factory that sets it, or give ${owner.pascal}Error.${refusal.camel} words of its own: a code names one refusal of a context (rule errors/code-unique).`,
    );
  }
}

interface Writing extends Refusal {
  readonly context: RenderContext;
}

function writeFactory(scope: Scope, file: string, { concept: owner, refusal, context }: Writing): void {
  const factory = renderTemplate('error/factory.ts.tpl', context).trimEnd();
  const existing = scope.ws.read(file);

  if (existing === undefined) {
    scope.ws.create(file, renderTemplate('error/concept-error.ts.tpl', { ...context, error: { factory } }));

    return;
  }

  const next = addFactory(existing, { className: `${owner.pascal}Error`, name: refusal.camel, text: factory });

  if (next === undefined) {
    throw new CliError(
      `${file} does not declare the class ${owner.pascal}Error.`,
      `Name the class after its file, or add the factory ${refusal.camel} by hand.`,
    );
  }

  if (next !== existing) {
    scope.ws.update(file, next);
  }
}

function writeSpecCase(scope: Scope, file: string, { concept: owner, refusal, context }: Writing): void {
  const text = renderTemplate('error/case.spec.ts.tpl', context).trimEnd();
  const existing = scope.ws.read(file);

  if (existing === undefined) {
    scope.ws.create(file, renderTemplate('error/concept-error.spec.ts.tpl', { ...context, error: { case: text } }));

    return;
  }

  const next = addSpecCase(existing, `${owner.pascal}Error.${refusal.camel}(`, text);

  if (next === undefined) {
    scope.ws.notes.push(
      `${file} has no describe block: add the case of ${owner.pascal}Error.${refusal.camel} by hand.`,
    );
  } else if (next !== existing) {
    scope.ws.update(file, next);
  }
}
