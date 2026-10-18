import { ESLintUtils, type JSONSchema, type TSESLint } from '@typescript-eslint/utils';
import { configuredSeverity } from '../../project/configured-severity.js';
import { describeLintedFile } from '../../project/describe-linted-file.js';
import type { LintedFile } from '../../project/linted-file.js';
import { suppressedLines } from '../suppressions/suppressed-lines.js';
import type { RuleDocs } from './rule-docs.js';

const DOCS = 'https://github.com/gbourgeat/ddd-ts-kit/blob/main/packages/eslint-plugin/docs/rules';

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
  /** The ESLint name, when it is not the id with a dash: a companion rule holding the part of an id that has its own severity. */
  readonly name?: string;
  /** `code` for a rule that rewrites what it reports. */
  readonly fixable?: 'code';
  readonly type: 'problem' | 'suggestion';
  readonly description: string;
  readonly recommended: 'error' | 'warn';
  /** A new rule, or what a rule judges more, is a warning first: the version in which it becomes an error. */
  readonly transition?: string;
  readonly messages: Readonly<Record<MessageIds, string>>;
  readonly schema?: readonly JSONSchema.JSONSchema4[];
  readonly defaultOptions?: Options;
  create(run: RuleRun<MessageIds, Options>): TSESLint.RuleListener;
}

const createNamedRule = ESLintUtils.RuleCreator<RuleDocs>((name) => `${DOCS}/${name}.md`);

export const eslintName = (ruleId: string): string => ruleId.replace('/', '-');

export function defineRule<MessageIds extends string, Options extends readonly unknown[] = []>(
  definition: RuleDefinition<MessageIds, Options>,
): TSESLint.RuleModule<MessageIds, Options, RuleDocs> {
  const name = definition.name ?? eslintName(definition.id);

  return createNamedRule<Options, MessageIds>({
    name,
    meta: {
      type: definition.type,
      docs: docsOfDefinition(definition, name),
      messages: definition.messages,
      schema: definition.schema ?? [],
      ...(definition.fixable === undefined ? {} : { fixable: definition.fixable }),
      ...(definition.defaultOptions === undefined ? {} : { defaultOptions: definition.defaultOptions }),
    },
    create(context, options) {
      const file = describeLintedFile(context);

      if (configuredSeverity(file.config, definition.id) === 'off') {
        return {};
      }

      return definition.create({
        context,
        sourceCode: context.sourceCode,
        file,
        options,
        report: reporter(context, definition.id),
      });
    },
  });
}

function docsOfDefinition<MessageIds extends string, Options extends readonly unknown[]>(
  { description, id, recommended, transition }: RuleDefinition<MessageIds, Options>,
  name: string,
): RuleDocs {
  return { description, ruleId: id, name, recommended, ...(transition === undefined ? {} : { transition }) };
}

function reporter<MessageIds extends string, Options extends readonly unknown[]>(
  context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
  ruleId: string,
): Report<MessageIds> {
  let suppressed: ReadonlySet<number> | undefined;

  return (descriptor) => {
    suppressed ??= suppressedLines(context.sourceCode, ruleId);

    if (!suppressed.has(lineOf(descriptor))) {
      context.report(descriptor);
    }
  };
}

function lineOf(descriptor: TSESLint.ReportDescriptor<string>): number {
  const position = descriptor.loc ?? ('node' in descriptor ? descriptor.node.loc : undefined);

  if (position === undefined) {
    return 1;
  }

  return 'start' in position ? position.start.line : position.line;
}
