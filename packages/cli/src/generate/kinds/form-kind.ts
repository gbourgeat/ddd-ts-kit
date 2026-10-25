import { CONFIG_FILE } from '../../config';
import { CliError } from '../../cli-error';
import type { Kind } from '../kind';
import { label } from '../label';
import { openScope } from '../open-scope';
import { controllerOf } from './presentation/controller-of';
import { controllerSource } from './presentation/controller-source';

export const formKind: Kind = {
  name: 'form',
  aliases: [],
  usage: 'form <context> <UseCase>',
  summary:
    'The form of a controller that receives a body: `defineForm` hints next to its schemas, named in `@Controller` (`@KitRoute` of a Nest controller) as `form`, served at GET /forms/<operationId> when "stack.forms" is "on". Fields, constraints and options come from the body schema, read-only and hidden fields from its field access.',
  positionals: ['context', 'UseCase'],
  writesShared: false,
  run: (request) => {
    const scope = openScope(request);
    const useCase = label(scope, request.args[1] ?? '', { what: 'use case', strip: ['controller'] });
    const { file, source } = controllerOf(scope, useCase);
    const nestBody = controllerSource.nestBody(source);

    if (nestBody === undefined && !/^\s*body[,:]/m.test(source)) {
      throw new CliError(
        `${useCase.pascal}Controller receives no body.`,
        'A form describes the body of a route: give the controller a body schema first.',
      );
    }

    if (/\bconst form = defineForm\b/.test(source)) {
      throw new CliError(`${useCase.pascal}Controller already declares its form.`, 'Edit its hints in the controller.');
    }

    const hinted = controllerSource.withOption(
      controllerSource.beforeController(source, hints(nestBody ?? 'Infer<typeof body>')),
      'form,',
    );

    const withForm = controllerSource.withImport(hinted, 'defineForm', '@ddd-ts-kit/http');

    scope.ws.update(
      file,
      nestBody === undefined ? controllerSource.withImport(withForm, 'type Infer', '@ddd-ts-kit/validation') : withForm,
    );

    if (scope.config.stack.forms !== 'on') {
      scope.ws.note(
        `The form is served once "stack.forms" is "on" in ${CONFIG_FILE}: run \`ddd-ts-kit init --force --forms on\`.`,
      );
    }
  },
};

/** The hints of the form, typed by the shape of the body: `Infer<typeof body>` of a schema, or the DTO class a Nest controller takes. */
function hints(shape: string): string {
  return `/** How the body of the route is entered, served as a form at GET /forms/<operationId> for the caller who asks. */
const form = defineForm<${shape}>({
  // TODO(domain): name the permission of the use case as its @Requires does (requires: { permission, subject, context }), so that only who may run it reads the form.
  // TODO(domain): group the fields (groups), and say per field what the schema cannot: its widget, the GET route its options come from (lookup), when it shows (visibleWhen) and when it is required (requiredWhen).
});
`;
}
