import { ESLintUtils, type JSONSchema, type TSESLint } from '@typescript-eslint/utils';
import { configuredSeverity } from '../project/config.js';
import { describeLintedFile, type LintedFile } from '../project/linted-file.js';
import { suppressedLines } from './suppressions.js';

const DOCS = 'https://github.com/gbourgeat/ddd-ts-kit/blob/main/packages/eslint-plugin/docs/rules';

export interface RuleDocs {
  readonly description: string;
  /** The id of docs/ARCHITECTURE.md, with its slash. */
  readonly ruleId: string;
  readonly recommended: 'error' | 'warn';
}

export type Report<MessageIds extends string> = (descriptor: TSESLint.ReportDescriptor<MessageIds>) => void;

interface RuleRun<MessageIds extends string, Options extends readonly unknown[]> {
  readonly context: Readonly<TSESLint.RuleContext<MessageIds, Options>>;
  readonly sourceCode: Readonly<TSESLint.SourceCode>;
  readonly file: LintedFile;
  readonly options: Readonly<Options>;
  /** Reports unless a `ddd-ts-kit-disable-next-line <id> -- <reason>` comment covers the line. */
  readonly report: Report<MessageIds>;
}

export interface RuleDefinition<MessageIds extends string, Options extends readonly unknown[]> {
  readonly id: string;
  readonly type: 'problem' | 'suggestion';
  readonly description: string;
  readonly recommended: 'error' | 'warn';
  readonly messages: Readonly<Record<MessageIds, string>>;
  readonly schema?: readonly JSONSchema.JSONSchema4[];
  readonly defaultOptions?: Options;
  create(run: RuleRun<MessageIds, Options>): TSESLint.RuleListener;
}

export type DddRule = TSESLint.RuleModule<string, readonly unknown[], RuleDocs>;

const createNamedRule = ESLintUtils.RuleCreator<RuleDocs>((name) => `${DOCS}/${name}.md`);

export const eslintName = (ruleId: string): string => ruleId.replace('/', '-');

export function defineRule<MessageIds extends string, Options extends readonly unknown[] = []>(
  definition: RuleDefinition<MessageIds, Options>,
): TSESLint.RuleModule<MessageIds, Options, RuleDocs> {
  return createNamedRule<Options, MessageIds>({
    name: eslintName(definition.id),
    meta: {
      type: definition.type,
      docs: { description: definition.description, ruleId: definition.id, recommended: definition.recommended },
      messages: definition.messages,
      schema: definition.schema ?? [],
      ...(definition.defaultOptions === undefined ? {} : { defaultOptions: definition.defaultOptions }),
    },
    create(context, options) {
      const file = describeLintedFile(context);
      if (configuredSeverity(file.config, definition.id) === 'off') return {};
      return definition.create({ context, sourceCode: context.sourceCode, file, options, report: reporter(context, definition.id) });
    },
  });
}

/** Every rule of this plugin is made by `defineRule`, which always writes its documentation. */
export function docsOf(rule: DddRule): RuleDocs {
  const { docs } = rule.meta;
  if (docs === undefined) throw new TypeError('A rule of @ddd-ts-kit/eslint-plugin has no meta.docs.');
  return docs;
}

function reporter<MessageIds extends string, Options extends readonly unknown[]>(
  context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
  ruleId: string,
): Report<MessageIds> {
  let suppressed: ReadonlySet<number> | undefined;
  return (descriptor) => {
    suppressed ??= suppressedLines(context.sourceCode, ruleId);
    if (!suppressed.has(lineOf(descriptor))) context.report(descriptor);
  };
}

function lineOf(descriptor: TSESLint.ReportDescriptor<string>): number {
  const position = descriptor.loc ?? ('node' in descriptor ? descriptor.node.loc : undefined);
  if (position === undefined) return 1;
  return 'start' in position ? position.start.line : position.line;
}
