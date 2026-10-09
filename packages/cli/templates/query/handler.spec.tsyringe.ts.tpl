import { describe, expect, it } from '{{tests.module}}';
import { createTestApplication, fake } from '@ddd-ts-kit/di';
import { platformTestModule } from '{{paths.integrationToPlatform}}/platform.module.js';
import { {{name.pascal}}Query, type {{name.pascal}}Result } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import { {{name.constant}}_READER, {{context.camel}}Module } from '../../{{context.kebab}}.module.js';
import { Fake{{name.pascal}}Reader } from '../fakes/{{name.kebab}}-reader.fake.js';

describe('{{name.title}}', () => {
  it('answers what the read model holds', async () => {
    const answer: {{name.pascal}}Result = {};
    const application = createTestApplication({
      modules: [platformTestModule, {{context.camel}}Module],
      fakes: [fake({{name.constant}}_READER, new Fake{{name.pascal}}Reader(answer))],
    });

    expect(await application.queryBus.execute(new {{name.pascal}}Query())).toEqual(answer);
  });

  // TODO(domain): replace each entry below by a test named after what "{{name.words}}" shows and to whom.
  it.todo('answers only what the asker is allowed to see');
  it.todo('applies each criterion of the query');
});
