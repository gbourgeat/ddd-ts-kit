{{#if validation.zod}}
import { z } from 'zod';
{{/if}}
import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, pageQuerySchema, pageResponse, pageSchemaOf, type Route } from '@ddd-ts-kit/http';
{{#if search.customSchema}}
import { err, ok, type QueryBus } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';
{{/if}}
{{#unless search.customSchema}}
import type { QueryBus } from '@ddd-ts-kit/kernel';
{{/unless}}
{{#if validation.zod}}
import { zodSchema } from '@ddd-ts-kit/validation/zod';
{{/if}}
{{#if validation.classValidator}}
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
{{/if}}
{{route.useCaseImport}}
{{#if validation.classValidator}}
import { {{name.pascal}}Line } from '{{alias.context}}/presentation/http/{{name.kebab}}-line.dto{{alias.ext}}';
{{/if}}

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

export function {{name.camel}}Route(queries: QueryBus): Route {
  return defineRoute(
    {
      method: '{{route.method}}',
      path: '{{route.path}}',
      operationId: '{{name.camel}}',
      summary: '{{name.title}}',
      tags: ['{{context.kebab}}'],
      request: { query },
      responses: { 200: { description: 'One page of the search.', body: pageSchemaOf(line) } },
      // TODO(domain): list the codes of the DomainErrors "{{name.words}}" can raise, so that they appear in the contract with their status.
      errors: ['UNAUTHORIZED', 'FORBIDDEN'],
      security: {{route.security}},
    },
    async (input) => {
      // TODO(domain): hand the criteria of the query over too, once the query schema declares them next to the page; map each line to its public fields.
      const page = await queries.execute(new {{route.input}}(actorOf(input.context.principal), input.query));

      return { status: 200, body: pageResponse(page, (item) => ({ id: item.id })) };
    },
  );
}
{{#if search.customSchema}}

function isLine(input: unknown): input is {{name.pascal}}Line {
  return typeof input === 'object' && input !== null && 'id' in input && typeof input.id === 'string';
}
{{/if}}
