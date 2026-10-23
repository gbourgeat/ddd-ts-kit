import { isRecord } from '../check/support/is-record';
import { CliError } from '../cli-error';
import { FACTORY_PREFIX } from '../generate/errors/factory-prefix';
import { toName } from '../naming';
import type { NamedPlan } from './named-plan';
import { PLAN_FILE } from './plan-file';
import type { PlannedRefusal } from './planned-refusal';

const FIX = `Run \`ddd-ts-kit error-factories --plan\` to write ${PLAN_FILE} again, then edit the names of each entry.`;
const CLASS = /^[A-Z][A-Za-z0-9]*$/;
const LETTERS = /^[A-Za-z]+$/;

/** The decisions of a plan to the named form, each one checked: a class named after the refusal, a factory with its prefix. */
export function readNamedPlan(text: string | undefined): NamedPlan {
  const raw: unknown = text === undefined ? undefined : JSON.parse(text);
  const contexts = isRecord(raw) && isRecord(raw['contexts']) ? raw['contexts'] : undefined;

  if (contexts === undefined) {
    throw new CliError(`${PLAN_FILE} holds no plan.`, FIX);
  }

  return {
    to: 'named',
    contexts: Object.fromEntries(
      Object.entries(contexts).map(([context, entries]) => [
        context,
        distinct((Array.isArray(entries) ? entries : []).map(entryOf)),
      ]),
    ),
  };
}

function entryOf(raw: unknown): PlannedRefusal {
  const text = (key: string): string => (isRecord(raw) && typeof raw[key] === 'string' ? raw[key].trim() : '');

  const entry = {
    from: text('from'),
    file: text('file'),
    code: text('code'),
    class: text('class'),
    factory: text('factory'),
  };

  if (entry.from === '' || entry.file === '' || entry.code === '') {
    throw new CliError(`${PLAN_FILE} has an entry without what it moves from, its file or its code.`, FIX);
  }

  if (!CLASS.test(entry.class) || entry.class.endsWith('Error')) {
    throw new CliError(
      `${PLAN_FILE}: "${entry.class}" is not the name of the refusal ${entry.from} builds.`,
      `Name it after the refusal, in PascalCase, never ending in Error: ${toName(entry.code).pascal.replace(/Error$/, '')} (rule errors/factory-name).`,
    );
  }

  if (!FACTORY_PREFIX.test(entry.factory) || !LETTERS.test(entry.factory)) {
    throw new CliError(
      `${PLAN_FILE}: "${entry.factory}" is not the name of a factory of ${entry.class}.`,
      `Start it with for, with, because, on or at, then an upper-case letter, letters only: for${toName(entry.factory).pascal.replace(/\d/g, '')} (rule errors/factory-name).`,
    );
  }

  return entry;
}

/** Within a context a class has one code, and each of its factories one name. */
function distinct(entries: readonly PlannedRefusal[]): PlannedRefusal[] {
  for (const [index, entry] of entries.entries()) {
    const earlier = entries.slice(0, index).filter((other) => other.class === entry.class);

    if (earlier.some((other) => other.code !== entry.code)) {
      throw new CliError(
        `${PLAN_FILE}: ${entry.class} is given two codes.`,
        'A refusal class has one code: give the other refusal a class of its own.',
      );
    }

    if (earlier.some((other) => other.factory === entry.factory)) {
      throw new CliError(
        `${PLAN_FILE}: ${entry.class}.${entry.factory} is planned twice.`,
        `Give each factory of ${entry.class} a name of its own.`,
      );
    }
  }

  return [...entries];
}
