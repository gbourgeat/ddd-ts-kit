import { isRecord } from '../config/values/is-record.js';

/** What the process that runs ESLint answers on its output: the report in the format asked, the messages, and the rules in transition. */
export interface LintAnswer {
  readonly report: string;
  readonly messages: readonly { readonly ruleId: string | null; readonly severity: number }[];
  /** The version in which each rule of the kit in transition becomes an error, by rule id. */
  readonly transitions: Readonly<Record<string, string>>;
}

/** The answer read from the output of that process, or undefined when it is not one. */
export function parseLintAnswer(output: string): LintAnswer | undefined {
  const parsed: unknown = JSON.parse(output);

  if (!isRecord(parsed) || typeof parsed['report'] !== 'string' || !Array.isArray(parsed['messages'])) {
    return undefined;
  }

  const transitions = isRecord(parsed['transitions']) ? parsed['transitions'] : {};

  return {
    report: parsed['report'],
    messages: parsed['messages'].filter(isRecord).map((message) => ({
      ruleId: typeof message['ruleId'] === 'string' ? message['ruleId'] : null,
      severity: typeof message['severity'] === 'number' ? message['severity'] : 2,
    })),
    transitions: Object.fromEntries(
      Object.entries(transitions).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
  };
}
