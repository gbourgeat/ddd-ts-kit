import { controllersFile } from '../../nest-controllers/controllers-file';
import { readNestControllers, type ProjectFiles } from '../../nest-controllers/read-nest-controllers';
import { renderControllersFile } from '../../nest-controllers/render-controllers-file';
import { toName } from '../../naming';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { Violation } from '../model/violation';
import { reporter } from '../support/reporter';

const REGENERATE =
  'Run `ddd-ts-kit docs` or `ddd-ts-kit generate`, or restart `npm run dev`, which rewrite it from the Nest controllers of the context and the signatures of their methods: the file is never edited by hand.';

export const nestControllersCurrent: Rule = {
  id: 'nest/controllers-current',
  description:
    'With Nest controllers ("stack.routes": "nest"), the generated <context>.controllers.ts of each context lists its Nest controllers with what each method answers, as its signature says it, and every route method answers a type the kit reads into a schema: a DTO class, `Accepted` or `void`, or says its body in `response` of `@KitRoute`.',
  scope: 'project',
  run(project) {
    if (project.config.stack.routes !== 'nest') {
      return [];
    }

    const files = projectFiles(project);

    return project.contextsOnDisk
      .filter((context) => project.config.contexts[context] !== undefined)
      .flatMap((context) => judged(project, files, context));
  },
};

function judged(project: Project, files: ProjectFiles, context: string): Violation[] {
  const report = reporter(project, nestControllersCurrent.id);
  const entries = readNestControllers(files, project.config, context);
  const file = `${project.config.contextsDir}/${context}/${controllersFile(context)}`;
  const expected = renderControllersFile(context, `${toName(context).camel}Controllers`, entries);

  const stale =
    files.read(file) === expected
      ? []
      : [
          report(
            { file, line: 1 },
            `${controllersFile(context)} is not what ddd-ts-kit writes from the Nest controllers of "${context}".`,
            REGENERATE,
          ),
        ];

  const unread = entries.flatMap((entry) =>
    entry.methods
      .filter(({ answer, declaresResponse }) => answer.kind === 'unread' && !declaresResponse)
      .map(({ name, line, answer }) =>
        report(
          { file: entry.file, line },
          `${entry.className}.${name} answers ${answer.kind === 'unread' ? answer.text : ''}, which the kit cannot read into the body of its route.`,
          'Answer a DTO class (`Promise<InvoiceDetailsAnswer>`), `Accepted` or `void`, or say the body in `response` of `@KitRoute`.',
        ),
      ),
  );

  return [...stale, ...unread];
}

function projectFiles(project: Project): ProjectFiles {
  const texts = new Map(project.files.map((file) => [file.path, file.text]));

  return {
    read: (file) => texts.get(file),
    under: (directory) => [...texts.keys()].filter((file) => file.startsWith(`${directory}/`)),
  };
}
