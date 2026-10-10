import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { calleeName } from '../support/calls/callee-name.js';
import type { ClassNode } from '../support/classes/class-name.js';
import { declarationReader } from '../support/declarations/declaration-reader.js';
import { defineRule, type Report } from '../support/rule/define-rule.js';
import { descendants } from '../support/descendants.js';
import { inContext } from '../support/imports/in-context.js';
import { staticString } from '../support/imports/static-string.js';
import { registeredJob } from '../support/scheduling/registered-job.js';

type MessageId = 'notLiteral' | 'format' | 'context' | 'actor';
type Finding = TSESLint.ReportDescriptor<MessageId>;

const JOB_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

const WHY =
  'The name of a job is its identity: the lock of its occurrences, its settings, its metrics and its system actor are keyed by it, so it is written once and never derived.';

export const schedulingJobName = defineRule<MessageId>({
  id: 'scheduling/job-name',
  type: 'problem',
  recommended: 'error',
  description:
    'A job is named `<context>.<job-name>` by a string literal, and its system actor carries that same name.',
  messages: {
    notLiteral: `The name of this job is not a string literal. ${WHY} Write \`'{{context}}.<job-name>'\` in lower-case kebab-case.`,
    format: `"{{name}}" is not a job name. ${WHY} Write \`'{{context}}.<job-name>'\`: two segments in lower-case kebab-case, the context then the job.`,
    context: `The job "{{name}}" is declared in the context "{{context}}". ${WHY} Write \`'{{context}}.{{job}}'\`: a job is named after the context it belongs to and leaves with it when the context is extracted.`,
    actor:
      'This job runs as `systemActor({{given}})` but is named "{{name}}". Write `systemActor(\'{{name}}\')`: the audit trail and the logs then name the job that acted.',
  },
  create({ file, sourceCode, report }) {
    const context = inContext(file)?.context;
    const declarationsOf = declarationReader(sourceCode.ast);
    const judging: Judging = { context, declared: [], report };

    const judgeClass = (node: ClassNode): void => {
      for (const declaration of declarationsOf(node).filter((candidate) => candidate.name === 'Scheduled')) {
        judgeName(judging, declaration.arguments[0], declaration.node);
      }
    };

    return {
      ClassDeclaration: judgeClass,
      ClassExpression: judgeClass,
      CallExpression(node) {
        const job = file.isTest ? undefined : registeredJob(node);

        if (job !== undefined) {
          judgeName(judging, job.registration.arguments[0], job.registration);
        }
      },
      'Program:exit'(program: TSESTree.Program) {
        if (!file.path.endsWith('.job.ts') || file.isTest) {
          return;
        }

        for (const finding of actorDefects(program, judging.declared[0], context)) {
          report(finding);
        }
      },
    };
  },
});

/** What judging the names of one file needs and gathers: the literal names it met, in order. */
interface Judging {
  readonly context: string | undefined;
  readonly declared: string[];
  readonly report: Report<MessageId>;
}

function judgeName(judging: Judging, node: TSESTree.Node | undefined, at: TSESTree.Node): void {
  const name = node === undefined ? undefined : staticString(node);

  if (name !== undefined) {
    judging.declared.push(name);
  }

  const finding = nameDefect(name, judging.context);

  if (finding !== undefined) {
    judging.report({ ...finding, node: node ?? at });
  }
}

interface Defect {
  readonly messageId: MessageId;
  readonly data: Record<string, string>;
}

function nameDefect(name: string | undefined, context: string | undefined): Defect | undefined {
  const here = context ?? '<context>';

  if (name === undefined) {
    return { messageId: 'notLiteral', data: { context: here } };
  }

  if (!JOB_NAME.test(name)) {
    return { messageId: 'format', data: { name, context: here } };
  }

  const [owner = '', job = ''] = name.split('.');

  return context === undefined || owner === context
    ? undefined
    : { messageId: 'context', data: { name, context, job } };
}

/** Every `systemActor(..)` of a job file passes the name the job is declared with; without a declaration in the file, a name of its context. */
function actorDefects(program: TSESTree.Program, declared: string | undefined, context: string | undefined): Finding[] {
  const calls = [...descendants(program)].flatMap((node) =>
    node.type === AST_NODE_TYPES.CallExpression && calleeName(node) === 'systemActor' ? [node] : [],
  );

  return calls.flatMap((call) => actorDefect(call, declared, context));
}

function actorDefect(
  call: TSESTree.CallExpression,
  declared: string | undefined,
  context: string | undefined,
): Finding[] {
  const [given] = call.arguments;
  const name = given === undefined ? undefined : staticString(given);
  const expected = declared ?? jobNameOf(name, context) ?? `${context ?? '<context>'}.<job-name>`;

  if (name === expected) {
    return [];
  }

  return [
    {
      node: given ?? call,
      messageId: 'actor',
      data: { given: name === undefined ? '..' : `'${name}'`, name: expected },
    },
  ];
}

/** The name itself, when it is a job name of the context: what an explicit-style job file is held to. */
function jobNameOf(name: string | undefined, context: string | undefined): string | undefined {
  return name !== undefined && nameDefect(name, context) === undefined ? name : undefined;
}
