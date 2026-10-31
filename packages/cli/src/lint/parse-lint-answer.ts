import { isRecord } from '../config/values/is-record';

/** What the process that runs ESLint answers on its output: the report in the format asked and the messages. */
export interface LintAnswer {
  readonly report: string;
  readonly messages: readonly { readonly ruleId: string | null; readonly severity: number }[];
}

/** The answer read from the output of that process, or undefined when it is not one. */
export function parseLintAnswer(output: string): LintAnswer | undefined {
  const parsed: unknown = JSON.parse(output);

  if (!isRecord(parsed) || typeof parsed['report'] !== 'string' || !Array.isArray(parsed['messages'])) {
    return undefined;
  }

  return {
    report: parsed['report'],
    messages: parsed['messages'].filter(isRecord).map((message) => ({
      ruleId: typeof message['ruleId'] === 'string' ? message['ruleId'] : null,
      severity: typeof message['severity'] === 'number' ? message['severity'] : 2,
    })),
  };
}
