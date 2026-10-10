import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { ImportTarget } from '../project/resolve-import.js';
import type { LintedFile } from '../project/linted-file.js';
import { className, type ClassNode } from '../support/classes/class-name.js';
import { constructorOf } from '../support/classes/constructor-of.js';
import { exportedClasses } from '../support/classes/exported-classes.js';
import { isCallable } from '../support/classes/is-callable.js';
import { memberName } from '../support/classes/member-name.js';
import { declarationReader } from '../support/declarations/declaration-reader.js';
import { defineRule, type Report } from '../support/rule/define-rule.js';
import { descendants } from '../support/descendants.js';
import { propertyName } from '../support/globals/property-name.js';
import { importListener } from '../support/imports/import-listener.js';
import { inContext } from '../support/imports/in-context.js';
import { dependencyListListener } from '../support/ports/dependency-list-listener.js';
import { importedBindings } from '../support/ports/imported-bindings.js';
import { isJobFile } from '../support/scheduling/is-job-file.js';
import { registeredJob } from '../support/scheduling/registered-job.js';
import { parameterTypeName } from '../support/types/parameter-type-name.js';

type MessageId = 'notAJob' | 'noCommand' | 'repository' | 'model' | 'misplaced';
type Tell = Report<MessageId>;
type Source = Readonly<TSESLint.SourceCode>;
type IsRepository = (name: string | undefined) => boolean;

const MODEL_FOLDERS = new Set(['aggregates', 'entities', 'services']);

const IN_THE_COMMAND =
  'A job is a schedule: it sends a command through the `CommandBus` and the work (loading aggregates, deciding, saving) is in the handler of that command, where it is authorized, transactional and tested like any other use case.';

export const schedulingJobTriggersUseCase = defineRule<MessageId>({
  id: 'scheduling/job-triggers-use-case',
  type: 'problem',
  recommended: 'error',
  description:
    'A job only triggers use cases: it lives in application/scheduling, implements ScheduledJob, sends a command and touches neither a repository nor the model.',
  messages: {
    notAJob:
      'This job file exports no class implementing `ScheduledJob`. Export one class `<Name>Job implements ScheduledJob` with a `run(execution)` method that sends a command.',
    noCommand: `{{className}}.run sends no command: nothing in it calls \`.execute(..)\`. ${IN_THE_COMMAND} Write \`await this.commands.execute(new <Command>(systemActor('<context>.<job>'), execution.scheduledAt))\`.`,
    repository: `{{className}} is given the repository {{name}}. ${IN_THE_COMMAND} Depend on \`CommandBus\` only and move what reads or writes {{name}} to the handler.`,
    model: `This job imports {{target}}. ${IN_THE_COMMAND} Remove the import and move what needs it to the handler.`,
    misplaced:
      '{{className}} is a scheduled job but lives in {{file}}. Move it to application/scheduling/<name>.job.ts of its context: a job is found, read and tested in one place.',
  },
  create({ file, sourceCode, report }) {
    if (inContext(file) === undefined || file.isTest) {
      return {};
    }

    return isJobFile(file.config, file.path) ? jobFile(file, sourceCode, report) : elsewhere(file, sourceCode, report);
  },
});

function jobFile(file: LintedFile, sourceCode: Source, tell: Tell): TSESLint.RuleListener {
  const imported = importedBindings(file, sourceCode.ast);

  const isRepository: IsRepository = (name) => name !== undefined && isRepositoryFile(imported.get(name)?.target);

  const owner = (): string => exportedClasses(sourceCode.ast)[0]?.id?.name ?? 'The job';

  const lists = dependencyListListener(sourceCode.ast, (dependency) => {
    if (isRepository(dependency.name)) {
      tell({ node: dependency, messageId: 'repository', data: { className: owner(), name: dependency.name } });
    }
  });

  const imports = importListener(file, ({ node, target }) => {
    if (isModel(target)) {
      tell({ node, messageId: 'model', data: { target: describeModel(target) } });
    }
  });

  return {
    ...imports,
    ...lists,
    CallExpression(node) {
      imports.CallExpression?.(node);
      lists.CallExpression?.(node);
    },
    Program: (program) => judgeJobs(program, isRepository, tell),
  };
}

function judgeJobs(program: TSESTree.Program, isRepository: IsRepository, tell: Tell): void {
  const jobs = exportedClasses(program).filter((node) =>
    node.implements.some(
      (port) => port.expression.type === AST_NODE_TYPES.Identifier && port.expression.name === 'ScheduledJob',
    ),
  );

  if (jobs.length === 0) {
    tell({ loc: { line: 1, column: 0 }, messageId: 'notAJob' });
  }

  for (const job of jobs) {
    judgeJob(job, isRepository, tell);
  }
}

function judgeJob(job: TSESTree.ClassDeclaration, isRepository: IsRepository, tell: Tell): void {
  const run = job.body.body.find((member) => isCallable(member) && memberName(member) === 'run');

  if (run === undefined || !sendsCommand(run)) {
    tell({ node: run ?? job.id ?? job, messageId: 'noCommand', data: { className: className(job) } });
  }

  for (const parameter of constructorOf(job.body)?.value.params ?? []) {
    const name = parameterTypeName(parameter);

    if (isRepository(name)) {
      tell({ node: parameter, messageId: 'repository', data: { className: className(job), name } });
    }
  }
}

function sendsCommand(run: TSESTree.Node): boolean {
  return [...descendants(run)].some(
    (node) =>
      node.type === AST_NODE_TYPES.CallExpression &&
      node.callee.type === AST_NODE_TYPES.MemberExpression &&
      propertyName(node.callee) === 'execute',
  );
}

function isRepositoryFile(target: ImportTarget | undefined): boolean {
  return (
    target?.kind === 'file' &&
    target.location.area === 'context' &&
    target.location.layer === 'domain' &&
    target.location.inside[0] === 'repositories'
  );
}

function isModel(target: ImportTarget): boolean {
  if (target.kind !== 'file' || target.location.area !== 'context') {
    return false;
  }

  const { layer, inside } = target.location;

  return layer === 'infrastructure' || (layer === 'domain' && MODEL_FOLDERS.has(inside[0] ?? ''));
}

function describeModel(target: ImportTarget): string {
  if (target.kind !== 'file' || target.location.area !== 'context') {
    return 'the model';
  }

  return target.location.layer === 'infrastructure' ? 'infrastructure/' : `domain/${target.location.inside[0] ?? ''}/`;
}

/** Outside application/scheduling: no class carries `@Scheduled`, and a module registers only jobs that live there. */
function elsewhere(file: LintedFile, sourceCode: Source, tell: Tell): TSESLint.RuleListener {
  const declarationsOf = declarationReader(sourceCode.ast);
  const imported = importedBindings(file, sourceCode.ast);

  const judgeClass = (node: ClassNode): void => {
    for (const declaration of declarationsOf(node).filter((candidate) => candidate.name === 'Scheduled')) {
      tell({ node: declaration.node, messageId: 'misplaced', data: { className: className(node), file: file.path } });
    }
  };

  return {
    ClassDeclaration: judgeClass,
    ClassExpression: judgeClass,
    CallExpression(node) {
      const handler = registeredJob(node)?.handler;
      const target = handler === undefined ? undefined : imported.get(handler.name)?.target;

      if (handler !== undefined && target?.kind === 'file' && !isJobFile(file.config, target.path)) {
        tell({ node: handler, messageId: 'misplaced', data: { className: handler.name, file: target.path } });
      }
    },
  };
}
