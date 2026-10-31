import type { LintVerdict } from './lint-verdict';

/** The lines `ddd-ts-kit lint` adds after the report of ESLint: why it fails. */
export function formatVerdict({ errors, warnings }: LintVerdict): string[] {
  const failure =
    warnings > 0
      ? [
          `${warnings} warning(s) fail the lint, as an error does: fix each one, or raise its rule to error and record the existing findings (docs/tools/quality-baseline.md, "Warnings fail the lint").`,
        ]
      : [];

  return [...(errors > 0 ? [`${errors} error(s).`] : []), ...failure];
}
