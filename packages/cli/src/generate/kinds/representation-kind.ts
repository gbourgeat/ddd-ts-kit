import { CONFIG_FILE } from '../../config';
import { CliError } from '../../cli-error';
import type { Kind } from '../kind';
import { label } from '../label';
import { openScope } from '../open-scope';
import { controllerOf } from './presentation/controller-of';
import { controllerSource } from './presentation/controller-source';

const SHORT_NAMES: Readonly<Record<string, string>> = { xml: 'application/xml', csv: 'text/csv' };
const XML = 'application/xml';
const CSV = 'text/csv';

export const representationKind: Kind = {
  name: 'representation',
  aliases: [],
  usage: 'representation <context> <UseCase> <xml|csv|media/type>[,...]',
  summary:
    'Makes a controller answer in more media types than JSON: `produces` in `@Controller` (`@KitRoute` of a Nest controller), and `consumes` of XML for a route that receives a body. The request chooses by its Accept header when "stack.representations" is "negotiated"; the contract lists every media type. After `generate route <context> <UseCase>` under "stack.routes": "controllers" or "nest", or `generate controller <context> <UseCase>`.',
  positionals: ['context', 'UseCase', 'media'],
  writesShared: false,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);
    const useCase = label(scope, request.args[1] ?? '', { what: 'use case', strip: ['controller'] });
    const media = mediaTypesOf(request.args[2] ?? '');
    const { file, source } = controllerOf(scope, useCase);

    if (/^\s*produces:/m.test(source)) {
      throw new CliError(
        `${useCase.pascal}Controller already declares what it produces.`,
        'Edit its `produces` in the controller.',
      );
    }

    const receivesBody = controllerSource.nestBody(source) !== undefined || /^\s*body[,:]/m.test(source);
    const receivesXml = media.includes(XML) && receivesBody;
    const produced = controllerSource.withOption(source, `produces: [${media.map((type) => `'${type}'`).join(', ')}],`);

    scope.ws.update(file, receivesXml ? controllerSource.withOption(produced, `consumes: ['${XML}'],`) : produced);

    if (receivesXml) {
      scope.ws.note(
        `The route now also reads its body in XML (\`consumes: ['${XML}']\`), and answers 415 to another media type: remove \`consumes\` from ${controllerSource.isNest(source) ? '@KitRoute' : '@Controller'} if only the answer was to be XML.`,
      );
    }

    tellWhatIsLeft(scope, { media, source });
  },
};

function mediaTypesOf(written: string): string[] {
  const media = written
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => (Object.hasOwn(SHORT_NAMES, part) ? (SHORT_NAMES[part] ?? part) : part));

  const invalid = media.find((type) => !/^[a-z]+\/[a-z0-9.+-]+$/.test(type) || type === 'application/json');

  if (media.length === 0 || invalid !== undefined) {
    throw new CliError(
      `"${written}" names no media type besides JSON.`,
      'Name xml, csv or a media type such as application/xml, comma-separated: JSON is always answered.',
    );
  }

  return [...new Set(media)];
}

function tellWhatIsLeft(
  scope: ReturnType<typeof openScope>,
  { media, source }: { media: readonly string[]; source: string },
): void {
  if (media.includes(CSV) && !/\b(?:pageSchemaOf|streamSchemaOf)\(/.test(source)) {
    scope.ws.note(
      'CSV writes a list of flat rows: answer a page (pageSchemaOf) or a streamed list (streamSchemaOf) of an item whose fields are scalars, or the routes are refused when they are mounted.',
    );
  }

  if (scope.config.stack.representations !== 'negotiated') {
    scope.ws.note(
      `The route answers JSON only until "stack.representations" is "negotiated" in ${CONFIG_FILE}: run \`ddd-ts-kit init --force --representations negotiated\`.`,
    );
  }
}
