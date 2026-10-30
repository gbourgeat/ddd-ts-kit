import { describe, expect, it } from '{{tests.module}}';
import { nestControllerRoute } from '@ddd-ts-kit/http/nest';
import { routeOf } from '@ddd-ts-kit/http/testing';
import { {{route.recordingBus}} } from '@ddd-ts-kit/kernel/testing';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
{{route.messageImport}}
{{route.specImports}}
import { {{context.camel}}Controllers } from '{{alias.context}}/{{context.kebab}}.controllers{{alias.ext}}';

describe('{{route.method}} {{route.path}}', () => {
  it('answers {{route.status}} and hands the use case what the client sent', async () => {
    const {{route.bus}} = new {{route.recordingBus}}(){{route.recordingAnswer}};

    const served = nestControllerRoute({{name.pascal}}Controller, {
      instanceOf: () => new {{name.pascal}}Controller({{route.specArguments}}),
      // A DTO without a decorated field yet accepts the empty object alone: whitelist and forbidNonWhitelisted refuse any field.
      schemaOfClass: (dto) => classSchema(dto, { validator: { forbidUnknownValues: false } }),
    });

    const { {{route.sentParts}} } = routeOf(served);

    const response = await send({{route.sentRequest}});

    {{route.answerExpectation}}
    {{route.messageExpectation}}
    expect(route.path).toBe('{{route.path}}');
    expect({{context.camel}}Controllers).toContain({{name.pascal}}Controller);
  });
  {{#if route.refusesMissing}}

  it('refuses a body without `{{route.missingField}}` with 422, naming the field', async () => {
    const {{route.bus}} = new {{route.recordingBus}}();

    const served = nestControllerRoute({{name.pascal}}Controller, {
      instanceOf: () => new {{name.pascal}}Controller({{route.specArguments}}),
      schemaOfClass: (dto) => classSchema(dto, { validator: { forbidUnknownValues: false } }),
    });

    const { send } = routeOf(served);

    const response = await send({{route.missingRequest}});

    expect(response).toMatchObject({
      status: 422,
      body: { code: 'VALIDATION_FAILED', issues: [{ path: 'body.{{route.missingField}}' }] },
    });

    expect({{route.bus}}.executed).toEqual([]);
  });
  {{/if}}

  // TODO(domain): replace each entry below by a test of the same shape, through the same `routeOf` (`{ caller }` names another one, `anonymousActor()` of the kernel nobody).
  it.todo('refuses an input that does not have the expected shape with 422');
  it.todo('answers the documented status for each error code of the use case');
});
