import { CliError } from '../../cli-error.js';
import { concept } from '../concept.js';
import { emit } from '../emit.js';
import type { Kind } from '../kind.js';
import { named } from '../named.js';
import { openScope } from '../open-scope.js';
import { vars } from '../vars.js';

const ERROR_CODE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

export const domainErrorKind: Kind = {
  name: 'domain-error',
  aliases: [],
  usage: 'domain-error <context> <Name> [--code CODE]',
  summary: 'A DomainError with a stable code, and its spec.',
  positionals: ['context', 'Name'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);
    const name = concept({ ...scope, flags: { ...scope.flags, allowName: true } }, request.args[1] ?? '', { what: 'domain error', strip: ['error'] });
    const code = request.flags.code ?? name.constant;

    if (!ERROR_CODE.test(code)) {
      throw new CliError(`"${code}" is not a valid error code.`, 'Use upper-case words separated by underscores, for example INVOICE_ALREADY_ISSUED.');
    }

    emit(scope, vars(scope, { name: named(name), error: { code } }), [
      ['domain-error/domain-error.ts.tpl', `domain/errors/${name.kebab}.error.ts`],
      ['domain-error/domain-error.spec.ts.tpl', `test/unit/${name.kebab}.error.spec.ts`],
    ]);
  },
};
