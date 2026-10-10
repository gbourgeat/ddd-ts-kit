const UNIT_MS: Readonly<Record<string, number>> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
const DURATION = /^(\d+)(ms|s|m|h|d)$/;

/** Why a text is not an interval of a job, or undefined: a positive whole number of milliseconds, or `30s`, `15m`, `2h`, `1d`. */
export function durationProblem(text: string): string | undefined {
  const [, amount, unit] = DURATION.exec(text.trim()) ?? [];

  const ms = /^\d+$/.test(text.trim())
    ? Number(text)
    : Number(amount ?? Number.NaN) * (UNIT_MS[unit ?? ''] ?? Number.NaN);

  if (Number.isSafeInteger(ms) && ms > 0) {
    return undefined;
  }

  return `"${text}" is not a duration: write a positive whole number of milliseconds, or a text such as 30s, 15m, 2h, 1d.`;
}
