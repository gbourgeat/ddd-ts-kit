import { CONFIG_FILE } from '../../config';
import { ESLINT_AUTHORITY } from './eslint-authority';
import { ESLINT_ONLY_RULES } from './eslint-only-rules';
import { FORMATTER_RULE } from './formatter-rule';

/** A rule of the architecture reference another tool decides: this checker lists and explains it, and judges nothing. */
export interface DelegatedRule {
  readonly id: string;
  readonly description: string;
  /** The tool that decides, as `ddd-ts-kit rules --json` names it. */
  readonly checkedBy: string;
  /** Appended to the description in the listing. */
  readonly authority: string;
  /** Where the rule is checked and how it is settled, for `ddd-ts-kit explain`. */
  readonly where: string;
  /** The script of the project that runs the tool. */
  readonly script: string;
}

export const DELEGATED_RULES: readonly DelegatedRule[] = [
  ...ESLINT_ONLY_RULES.map((rule) => ({
    ...rule,
    checkedBy: '@ddd-ts-kit/eslint-plugin',
    authority: ESLINT_AUTHORITY,
    script: 'npm run lint',
    where: `This rule reads the shape of the code, a class or a test, which needs a syntax tree: it is ${ESLINT_AUTHORITY} as \`ddd-ts-kit/${rule.id.replace('/', '-')}\` (\`npm run lint\`), not by \`ddd-ts-kit check\`. Its severity is still set under "rules" in ${CONFIG_FILE}.`,
  })),
  {
    ...FORMATTER_RULE,
    checkedBy: '@biomejs/biome',
    authority: 'checked by Biome',
    script: 'npm run format:check',
    where:
      'Laying out a file is the work of a formatter, and one way to lay it out leaves nothing to discuss in a review: it is checked by Biome with the `biome.json` of the project (`npm run format:check`, on staged files and in CI), not by `ddd-ts-kit check`, and `npm run format` settles it. It has no severity: a file is formatted or it is not.',
  },
];
