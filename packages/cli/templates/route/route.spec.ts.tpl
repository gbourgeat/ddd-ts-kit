import { describe, expect, it } from '{{tests.module}}';
import { routeOf } from '@ddd-ts-kit/http/testing';
import { {{route.recordingBus}} } from '@ddd-ts-kit/kernel/testing';
{{route.messageImport}}
import { {{name.camel}}Route } from '{{alias.context}}/presentation/http/{{name.kebab}}.route{{alias.ext}}';

describe('{{route.method}} {{route.path}}', () => {
  it('answers {{route.status}} and hands the use case what the client sent', async () => {
    const {{route.bus}} = new {{route.recordingBus}}(){{route.recordingAnswer}};
    {{#if route.isSearch}}

    {{/if}}
    const { {{route.sentPartsOfRoute}} } = routeOf({{name.camel}}Route({{route.bus}}));

    const response = await send({{route.sentRequest}});

    {{route.answerExpectation}}
    {{route.messageExpectation}}
  });

  // TODO(domain): replace each entry below by a test of the same shape, through the same `routeOf` (`{ caller }` names another one, `anonymousActor()` of the kernel nobody).
  it.todo('refuses an input that does not have the expected shape with 422');
  it.todo('answers the documented status for each error code of the use case');
});
