import { CONFIG_FILE } from '../../config';
import { CliError } from '../../cli-error';
import { accessVars } from '../access-vars';
import { concept } from '../concept';
import { emit } from '../emit';
import type { Kind } from '../kind';
import { learnTerms } from '../learn-terms';
import { named } from '../named';
import { openScope } from '../open-scope';
import type { Scope } from '../scope';
import { specVars } from '../spec-vars';
import { vars } from '../vars';
import { wire } from '../wire';
import { writeNestUploadController } from './file-upload/write-nest-upload-controller';
import { writeUploadController } from './file-upload/write-upload-controller';
import { findUseCase } from './route/find-use-case';
import { parseEndpoint } from './route/parse-endpoint';
import { planController } from './route/plan-controller';

export const fileUploadKind: Kind = {
  name: 'file-upload',
  aliases: [],
  usage:
    'file-upload <context> <UseCaseName> --path <path> (--permission <aggregate>.<action> [--grant <role>] | --public) [--method <POST|PUT>] [--group <Name>] [--term "<Term>=<meaning>"]...',
  summary:
    'An upload: a controller that declares the file it receives (`@Upload()` of a Nest controller; size and media types in the contract, checked as it streams), the command that carries it as a FileUpload (staged by the command bus before the transaction), the handler that records it and promotes it with the commit, and their specs. Needs "stack.storage".',
  positionals: ['context', 'UseCaseName'],
  writesShared: true,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);

    assertFileStack(scope);
    learnTerms(scope);

    const name = concept(scope, request.args[1] ?? '', {
      what: 'use case',
      strip: ['command', 'handler', 'controller', 'upload'],
    });

    const access = accessVars(scope, { name, kind: 'Command' });
    const context = vars(scope, { name: named(name), access, spec: specVars(scope, access) });
    const folder = `application/commands/${name.kebab}`;

    emit(scope, context, [
      ['file-upload/command.ts.tpl', `${folder}/${name.kebab}.command.ts`],
      ['file-upload/handler.ts.tpl', `${folder}/${name.kebab}.handler.ts`],
      ['file-upload/handler.spec.ts.tpl', `test/unit/${name.kebab}.handler.spec.ts`],
    ]);

    wire(scope, 'file-upload', context);

    const flags = { ...request.flags, method: request.flags.method ?? 'POST', command: true, query: false };
    const endpoint = parseEndpoint(flags);
    const useCase = findUseCase(scope, name, flags);

    const plan = planController(scope, { name, endpoint, useCase });

    if (scope.config.stack.routes === 'nest') {
      writeNestUploadController(scope, plan);
    } else {
      writeUploadController(scope, plan);
    }
  },
};

function assertFileStack(scope: Scope): void {
  const { storage, http } = scope.config.stack;

  if (storage !== 'none' && http !== 'none') {
    return;
  }

  throw new CliError(
    storage === 'none'
      ? 'This project keeps no files (stack.storage is "none").'
      : 'This project has no HTTP stack (stack.http is "none").',
    `Run \`ddd-ts-kit init --force --storage local\` (or s3) to wire the file storage, with an HTTP stack in ${CONFIG_FILE}; the content of files never goes in the database.`,
  );
}
