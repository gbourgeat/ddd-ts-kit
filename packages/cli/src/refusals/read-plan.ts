import { isRecord } from '../check/support/is-record';
import { CliError } from '../cli-error';
import { refusalCode } from '../generate/errors/refusal-code';
import { refusalName } from '../generate/errors/refusal-name';
import { toName } from '../naming';
import type { MigrationPlan } from './migration-plan';
import { PLAN_FILE } from './plan-file';
import type { PlannedFactory } from './planned-factory';

const FIX = `Run \`ddd-ts-kit error-factories --plan\` to write ${PLAN_FILE} again, then give each entry its concept.`;

/** The decisions of the plan file, each one checked: a concept, a factory name that says the code. */
export function readPlan(text: string | undefined): MigrationPlan {
  const raw: unknown = text === undefined ? undefined : JSON.parse(text);
  const contexts = isRecord(raw) && isRecord(raw['contexts']) ? raw['contexts'] : undefined;

  if (contexts === undefined) {
    throw new CliError(`${PLAN_FILE} holds no plan.`, FIX);
  }

  return {
    contexts: Object.fromEntries(
      Object.entries(contexts).map(([context, entries]) => [
        context,
        (Array.isArray(entries) ? entries : []).map(entryOf),
      ]),
    ),
  };
}

function entryOf(raw: unknown): PlannedFactory {
  const text = (key: string): string => (isRecord(raw) && typeof raw[key] === 'string' ? raw[key] : '');

  const entry = {
    class: text('class'),
    file: text('file'),
    code: text('code'),
    concept: text('concept'),
    factory: text('factory'),
  };

  if (entry.class === '' || entry.file === '' || entry.code === '') {
    throw new CliError(`${PLAN_FILE} has an entry without its class, file or code.`, FIX);
  }

  if (entry.concept === '') {
    throw new CliError(
      `${PLAN_FILE}: ${entry.class} has no concept.`,
      `Set "concept" to the term of the glossary this refusal is about (for example the aggregate it is refused on): ${entry.class} becomes a factory of <Concept>Error.`,
    );
  }

  const concept = toName(entry.concept.replace(/Error$/, ''));
  const refusal = refusalName(entry.factory);

  // Refuses a name that does not say the code, with the names that would.
  refusalCode({ concept, refusal }, entry.code);

  return { ...entry, concept: concept.pascal, factory: refusal.camel };
}
