import path from 'node:path';
import { bindingCalls } from '../declarations/binding-calls.js';
import { dependencyLists } from '../declarations/dependency-lists.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { perFile } from '../support/per-file.js';
import { escapeRegExp } from '../text/escape-reg-exp.js';

const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const TOKEN_CALL = /(?<![\w$.])token\s*(?:<[^<>()]*(?:<[^<>()]*>[^<>()]*)*>)?\s*\(/g;
const SYMBOL = /^Symbol\s*(?:\.\s*for\s*)?\(/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const PORT_FIX =
  'Declare the port as an abstract class (domain/repositories/*.repository.ts or application/ports/*.port.ts) and name that class: the class is the contract and the injection token at once, and the compiler checks the list against the constructor.';

export const portsNoTokenConstant: Rule = {
  id: 'ports/no-token-constant',
  description:
    'No injection token beside the port: no token(), no Symbol or string token, no UPPER_SNAKE_CASE name in a dependency list, no *.ports.ts nor tokens.ts file.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) =>
      file.isTest ? [] : [...tokenFile(file), ...tokenCalls(file), ...literalTokens(file), ...constantsInLists(file)],
    );
  },
};

function tokenFile(file: SourceFile): Finding[] {
  const name = path.posix.basename(file.path);

  if (name !== 'tokens.ts' && !name.endsWith('.ports.ts')) {
    return [];
  }

  return [
    {
      line: 1,
      message: `"${name}" is a file of injection tokens.`,
      fix: `Delete it and give each port its own file holding one abstract class (application/ports/<name>.port.ts, domain/repositories/<name>.repository.ts): the class is the token.`,
    },
  ];
}

/** A call of a function named `token` imported from a package of the kit. */
function tokenCalls(file: SourceFile): Finding[] {
  const imported = file.imports.some(
    ({ target, names }) =>
      target.kind === 'package' && target.name.startsWith('@ddd-ts-kit/') && names.includes('token'),
  );

  if (!imported) {
    return [];
  }

  return [...file.scan.code.matchAll(TOKEN_CALL)].map((match) => ({
    line: file.scan.lineAt(match.index),
    message: 'token(...) declares an injection token beside the port.',
    fix: PORT_FIX,
  }));
}

/** A `Symbol(..)`, a `Symbol.for(..)` or a string given to a binding call, written in place or held by a local constant. */
function literalTokens(file: SourceFile): Finding[] {
  return bindingCalls(file).flatMap(({ method, token, line }) => {
    const code = token?.code ?? '';

    if (SYMBOL.test(code)) {
      return [{ line, message: `${method}(...) is given a symbol as its token.`, fix: PORT_FIX }];
    }

    if (/^['"`]/.test(code)) {
      return [{ line, message: `${method}(...) is given a string as its token.`, fix: PORT_FIX }];
    }

    const declared = IDENTIFIER.test(code)
      ? new RegExp(
          `(?<![\\w$.])(?:const|let|var)\\s+${escapeRegExp(code)}\\s*(?::[^=;]+)?=\\s*Symbol\\s*(?:\\.\\s*for\\s*)?\\(`,
        ).exec(file.scan.code)
      : null;

    return declared === null
      ? []
      : [
          {
            line: file.scan.lineAt(declared.index),
            message: `${code} is a symbol declared as an injection token and given to ${method}(...).`,
            fix: PORT_FIX,
          },
        ];
  });
}

function constantsInLists(file: SourceFile): Finding[] {
  return dependencyLists(file).flatMap(({ owner, names }) =>
    names
      .filter(({ name }) => name.length > 1 && UPPER_SNAKE.test(name))
      .map(({ name, line }) => ({
        line,
        message: `The dependency list of ${owner} names the constant ${name}: a list names ports, which are abstract classes.`,
        fix: PORT_FIX,
      })),
  );
}
