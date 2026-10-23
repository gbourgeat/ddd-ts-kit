import { KIT_ERROR_CODES } from '../../check/errors/kit-error-codes';
import { CliError } from '../../cli-error';
import type { Name } from '../../naming';
import type { Scope } from '../scope';
import { codesOfContext } from './codes-of-context';
import { ERROR_CODE } from './error-code-pattern';

export interface CodeRequest {
  readonly refusal: Name;
  /** The file of the closed list, and what it lists: class name to code. */
  readonly file: string;
  readonly listed: ReadonlyMap<string, string>;
  /** The code given with `--code`. */
  readonly asked: string | undefined;
}

/**
 * The code a refusal class sets: the one `codes.ts` already lists under its name (a migrated
 * project keeps its codes, the code is the contract), else the one asked, else its name in
 * constant case. A new code is one no other refusal of the context sets (rule errors/code-unique).
 */
export function namedRefusalCode(scope: Scope, request: CodeRequest): string {
  const { refusal, file, listed, asked } = request;
  const known = listed.get(refusal.pascal);

  if (known !== undefined) {
    if (asked !== undefined && asked !== known) {
      throw new CliError(
        `${refusal.pascal} already sets the code "${known}" in ${file}.`,
        `Leave --code out, or change the code in ${file} with every client that reads it: the code is the contract.`,
      );
    }

    return known;
  }

  const code = asked ?? refusal.constant;

  refuseMalformed(code);
  refuseKitCode(code, refusal);
  refuseTaken(scope, request, code);

  return code;
}

function refuseMalformed(code: string): void {
  if (!ERROR_CODE.test(code)) {
    throw new CliError(
      `"${code}" is not a valid error code.`,
      'Use upper-case words separated by underscores, for example INSUFFICIENT_FUNDS.',
    );
  }
}

function refuseKitCode(code: string, refusal: Name): void {
  if (KIT_ERROR_CODES.includes(code)) {
    throw new CliError(
      `The code "${code}" is one the packages of the kit raise.`,
      `Name ${refusal.pascal} after what the business refuses (UnknownInvoice, not NotFound), or give it a --code of its own.`,
    );
  }
}

function refuseTaken(scope: Scope, { refusal, file, listed }: CodeRequest, code: string): void {
  const owner = [...listed].find(([, value]) => value === code)?.[0];
  const taken = owner === undefined ? codesOfContext(scope).get(code) : `${file}, by ${owner}`;

  if (taken !== undefined) {
    throw new CliError(
      `The code "${code}" is already set in ${taken}.`,
      `Call a factory of the class that sets it, or give ${refusal.pascal} a --code of its own: a code names one refusal of a context (rule errors/code-unique).`,
    );
  }
}
