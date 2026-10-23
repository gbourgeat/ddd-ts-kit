import type { LintVerdict } from './lint-verdict';

/** The lines `ddd-ts-kit lint` adds after the report of ESLint: why it fails, and what is left to fix before an upgrade. */
export function formatVerdict({ errors, warnings, inTransition }: LintVerdict): string[] {
  const transition = inTransition.map(
    ({ ruleId, until, warnings: count }) =>
      `${ruleId}: ${count} warning(s), not counted while the rule is new; it becomes an error in ${until}: fix them before upgrading to it.`,
  );

  const failure =
    warnings > 0
      ? [
          `${warnings} warning(s) fail the lint, as an error does: fix each one, or raise its rule to error and record the existing findings (docs/tools/quality-baseline.md, "Warnings fail the lint").`,
        ]
      : [];

  return [...transition, ...(errors > 0 ? [`${errors} error(s).`] : []), ...failure];
}
