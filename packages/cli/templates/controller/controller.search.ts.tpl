{{#if validation.zod}}
import { z } from 'zod';
{{/if}}
{{#if validation.typebox}}
import Type from 'typebox';
{{/if}}
import {
  Controller,
  pageQuerySchema,
  pageResponse,
  pageSchemaOf,
  type HttpRequest,
  type PageBody,
} from '@ddd-ts-kit/http';
{{#if search.customSchema}}
import { err, ok, type QueryBus } from '@ddd-ts-kit/kernel';
import { customSchema, type Infer } from '@ddd-ts-kit/validation';
{{/if}}
{{#unless search.customSchema}}
import type { QueryBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
{{/unless}}
{{#if validation.zod}}
import { zodSchema } from '@ddd-ts-kit/validation/zod';
{{/if}}
{{#if validation.classValidator}}
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
{{/if}}
{{#if validation.typebox}}
import { typeboxSchema } from '@ddd-ts-kit/validation/typebox';
{{/if}}
{{route.imports}}

// TODO(domain): list here the fields of {{name.pascal}}Sort a client may sort by, and bound the size of a page.
const query = pageQuerySchema({ sortable: ['id'], maxSize: 100 });

{{#if validation.zod}}
const line = zodSchema(
  z.object({
    id: z.string(),
    // TODO(domain): declare the fields of {{name.pascal}}Item that are part of the public contract.
  }),
  { io: 'output' },
);
{{/if}}
{{#if validation.classValidator}}
const line = classSchema({{name.pascal}}Line);
{{/if}}
{{#if validation.typebox}}
const line = typeboxSchema(
  Type.Object({
    id: Type.String(),
    // TODO(domain): declare the fields of {{name.pascal}}Item that are part of the public contract.
  }),
);
{{/if}}
{{#if search.customSchema}}
interface {{name.pascal}}Line {
  readonly id: string;
  // TODO(domain): declare the fields of {{name.pascal}}Item that are part of the public contract, here and in the schema below.
}

const line = customSchema<{{name.pascal}}Line>(
  (input) => (isLine(input) ? ok(input) : err([{ path: 'id', code: 'invalid_type', message: 'Expected a text.' }])),
  {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
);
{{/if}}

@Controller({
  {{route.access}}
  method: '{{route.method}}',
  path: '{{route.groupPath}}',
  summary: '{{name.title}}',
  query,
  response: { status: 200, description: 'One page of the search.', body: pageSchemaOf(line) },
  // TODO(domain): list the codes of the refusals "{{name.words}}" can raise, as their factories set them, so that they appear in the contract with their status (`errors/known-code`).
  errors: [],
})
export class {{name.pascal}}Controller {
  constructor({{route.constructorParams}}) {}

  async handle(request: HttpRequest<{ query: Infer<typeof query> }>): Promise<PageBody<Infer<typeof line>>> {
    // TODO(domain): hand the criteria of the query over too, once the query schema declares them next to the page (a request mapper is their place); map each line to its public fields.
    const page = await this.queries.execute(new {{route.input}}(request.actor, request.query));

    return pageResponse(page, (item) => ({ id: item.id }));
  }
}
{{#if search.customSchema}}

function isLine(input: unknown): input is {{name.pascal}}Line {
  return typeof input === 'object' && input !== null && 'id' in input && typeof input.id === 'string';
}
{{/if}}
