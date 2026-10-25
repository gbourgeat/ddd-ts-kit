import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliError } from '../../src/cli-error';
import { resolveStack } from '../../src/init/stack/resolve-stack';
import type { StackOptions } from '../../src/init/stack/stack-options';
import { identityRefusal } from '../../src/presets/identity-refusal';
import type { DeclaredRefusal } from './support-matrix';

type Options = Partial<StackOptions>;

/** The message of a refusal of a combination, or `undefined` when it is accepted. */
export type Refuse = (options: Options) => string | undefined;

/** The flags of `init` that take no value from a list: a path, a free text, a switch. */
const NOT_LISTED = ['force', 'ciExtras', 'importAlias', 'allowNoOutbox', 'sdk', 'agentProfile'];

const STACK_OPTIONS = fileURLToPath(new URL('../../src/init/stack/stack-options.ts', import.meta.url));

/** An empty directory: `init` resolves the stack of a new project there. */
const NEW_PROJECT = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-matrix-'));

export const initRefusal: Refuse = (options) => {
  try {
    resolveStack(NEW_PROJECT, { force: false, ...options });

    return undefined;
  } catch (error) {
    if (error instanceof CliError) {
      return error.message;
    }

    throw error;
  }
};

/** What the identity preset refuses on a stack `init` accepts. */
export const identityPresetRefusal: Refuse = (options) =>
  initRefusal(options) === undefined
    ? identityRefusal(resolveStack(NEW_PROJECT, { force: false, ...options }))?.message
    : undefined;

/** The refusals met over every flag alone and every pair of flags, each with the first combination met. */
export function refusalsOverPairs(refuse: Refuse): Map<string, Options> {
  const met = new Map<string, Options>();
  const choices = listedFlags().flatMap((flag) => valuesOf(flag).map((value): Options => ({ [flag]: value })));
  const combinations = [{ sdk: true }, ...choices, ...pairsOf([{ sdk: true }, ...choices])];

  for (const options of combinations) {
    const message = refuse(options);

    if (message !== undefined && !met.has(message)) {
      met.set(message, options);
    }
  }

  return met;
}

/** The refusals met that no line declares, with the combination that met them. */
export function undeclared(met: Map<string, Options>, declared: readonly DeclaredRefusal[]): string[] {
  return [...met]
    .filter(([message]) => !declared.some(({ refusal }) => refusal.test(message)))
    .map(([message, options]) => `${message} (on ${JSON.stringify(options)})`);
}

/** The declared lines whose example is no longer refused that way. */
export function unheld(declared: readonly DeclaredRefusal[], refuse: Refuse): string[] {
  return declared
    .filter(({ refusal, example }) => !refusal.test(refuse(example) ?? ''))
    .map(
      ({ refusal, example }) => `${String(refusal)} on ${JSON.stringify(example)}: ${refuse(example) ?? 'accepted'}`,
    );
}

/** The flags of `StackOptions` read from its source, so that a new flag is enumerated without being listed here. */
export function listedFlags(): string[] {
  const source = fs.readFileSync(STACK_OPTIONS, 'utf8');

  return [...source.matchAll(/^ {2}readonly (\w+)\??:/gm)]
    .map((match) => match[1] ?? '')
    .filter((flag) => !NOT_LISTED.includes(flag));
}

/** The values of a flag, as the refusal of an unknown value lists them. */
export function valuesOf(flag: string): string[] {
  try {
    resolveStack(NEW_PROJECT, { force: false, [flag]: '\u0000' });
  } catch (error) {
    const listed = error instanceof CliError ? /Use one of: (.*)\.$/.exec(error.fix) : null;

    return listed?.[1]?.split(', ') ?? [];
  }

  return [];
}

function pairsOf(choices: readonly Options[]): Options[] {
  return choices.flatMap((first, index) =>
    choices
      .slice(index + 1)
      .filter((second) => Object.keys(second)[0] !== Object.keys(first)[0])
      .map((second) => ({ ...first, ...second })),
  );
}
