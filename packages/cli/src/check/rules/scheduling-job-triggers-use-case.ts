import { classesOf } from '../declarations/classes-of';
import { dependencyLists } from '../declarations/dependency-lists';
import type { Finding } from '../model/finding';
import type { Location } from '../model/location';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { isJobFile } from '../scheduling/is-job-file';
import type { ClassShape } from '../structure/class-shape';
import { importedFrom } from '../support/imported-from';
import { isDeclaredStyle } from '../support/is-declared-style';
import { perFile } from '../support/per-file';
import { callArguments } from '../text/call-arguments';
import { identifier } from '../text/identifier';

const HANDLED_BY = /\.\s*job\s*\([\s\S]*?\)\s*\.\s*handledBy\s*\(/g;
const EXECUTE = /\.\s*execute\s*\(/;
const MODEL_FOLDERS = ['aggregates', 'entities', 'services'];

const COMMAND_FIX =
  'Let the job send a command through the CommandBus port (`await this.commands.execute(new <Command>(systemActor(<job name>), execution.scheduledAt))`) and move the work to the handler of that command: a job only says when, the use case says what.';

const PLACE_FIX =
  'Move the class to application/scheduling/<name>.job.ts of its context: a job is found, tested and extracted with its context from that one place.';

export const schedulingJobTriggersUseCase: Rule = {
  id: 'scheduling/job-triggers-use-case',
  description:
    'A job only triggers use cases: a class of application/scheduling/*.job.ts implements ScheduledJob, sends a command from run, and depends on no repository, no part of the model and no adapter.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (file.isTest) {
        return [];
      }

      return isJobFile(file.path, file.location)
        ? [...shape(file), ...reach(file)]
        : [...declaredElsewhere(file, project), ...registeredFromElsewhere(file)];
    });
  },
};

/** The exported class implements `ScheduledJob` and its `run` sends at least one command. */
function shape(file: SourceFile): Finding[] {
  const job = file.structure.classes.find((candidate) => candidate.isExported && candidate.depth === 0);

  if (job === undefined) {
    return [
      {
        line: 1,
        message: 'The job file exports no class.',
        fix: 'Export one class implementing ScheduledJob, with a `run(execution: JobExecution)` method that sends a command.',
      },
    ];
  }

  const contract = job.implemented.includes('ScheduledJob')
    ? []
    : [
        {
          line: job.line,
          message: `${job.name} does not implement ScheduledJob.`,
          fix: `Write \`class ${job.name} implements ScheduledJob\`, the type exported by @ddd-ts-kit/kernel/declarations: the compiler then holds the class to \`run(execution)\`.`,
        },
      ];

  return [...contract, ...withoutCommand(file, job)];
}

function withoutCommand(file: SourceFile, job: ClassShape): Finding[] {
  const run = job.methods.find((method) => method.name === 'run');

  if (run !== undefined && EXECUTE.test(file.scan.code.slice(run.bodyStart, run.end))) {
    return [];
  }

  return [{ line: run?.line ?? job.line, message: `${job.name}.run sends no command.`, fix: COMMAND_FIX }];
}

/** What a job file must not reach: a repository in its dependencies, the model, an adapter. */
function reach(file: SourceFile): Finding[] {
  const dependencies = [
    ...dependencyLists(file).flatMap(({ names }) => names.map(({ name }) => name)),
    ...constructorTypes(file),
  ];

  return file.imports.flatMap(({ target, names, line }) => {
    if (target.kind !== 'file') {
      return [];
    }

    const what = reached(
      target.location,
      names.some((name) => dependencies.includes(name)),
    );

    return what === undefined
      ? []
      : [{ line, message: `The job ${what}: the work is in the command, not in the job.`, fix: COMMAND_FIX }];
  });
}

function constructorTypes(file: SourceFile): string[] {
  const parameters = file.structure.classes.flatMap((shape) =>
    shape.methods.filter((method) => method.isConstructor).flatMap((method) => method.parameters),
  );

  const imported = file.imports.flatMap(({ names }) => names);

  return imported.filter((name) => parameters.some((parameter) => identifier(name).test(parameter)));
}

function reached(location: Location, isDependency: boolean): string | undefined {
  if (location.area !== 'context') {
    return undefined;
  }

  if (location.layer === 'infrastructure') {
    return 'imports infrastructure/';
  }

  if (location.layer !== 'domain') {
    return undefined;
  }

  const [folder = ''] = location.inside;

  if (folder === 'repositories') {
    return isDependency ? 'depends on a repository' : undefined;
  }

  return MODEL_FOLDERS.includes(folder) ? `imports domain/${folder}/` : undefined;
}

/** Outside the declared style nothing else says that a class carrying `@Scheduled` is out of place. */
function declaredElsewhere(file: SourceFile, project: Project): Finding[] {
  if (isDeclaredStyle(project)) {
    return [];
  }

  return classesOf(file.scan).flatMap((declared) =>
    declared.decorations
      .filter(({ name }) => name === 'Scheduled')
      .map(({ line }) => ({
        line,
        message: `${declared.name} carries @Scheduled outside application/scheduling/*.job.ts.`,
        fix: PLACE_FIX,
      })),
  );
}

/** `builder.job(..).handledBy(Job, ..)` with a class that does not come from a job file. */
function registeredFromElsewhere(file: SourceFile): Finding[] {
  const { code } = file.scan;

  return [...code.matchAll(HANDLED_BY)].flatMap((match) => {
    const job = callArguments(code, match.index + match[0].length - 1)[0]?.code ?? '';
    const target = importedFrom(file, job)?.target;

    if (target?.kind !== 'file' || isJobFile(target.path, target.location)) {
      return [];
    }

    return [
      {
        line: file.scan.lineAt(match.index),
        message: `The job ${job} is registered from ${target.path}, which is not a job file.`,
        fix: PLACE_FIX,
      },
    ];
  });
}
