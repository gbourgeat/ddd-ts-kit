import { describe, expect, it } from '{{tests.module}}';
import { createTestBuses } from '@ddd-ts-kit/testing';
import { {{name.pascal}}Handler } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.handler.js';
import { {{name.pascal}}Query, type {{name.pascal}}Result } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import { Fake{{name.pascal}}Reader } from '../fakes/{{name.kebab}}-reader.fake.js';

describe('{{name.title}}', () => {
  it('answers what the read model holds', async () => {
    const answer: {{name.pascal}}Result = {};
    const { queryBus } = createTestBuses();
    queryBus.register({{name.pascal}}Query, new {{name.pascal}}Handler(new Fake{{name.pascal}}Reader(answer)));

    expect(await queryBus.execute(new {{name.pascal}}Query())).toEqual(answer);
  });

  // TODO(domain): replace each entry below by a test named after what "{{name.words}}" shows and to whom.
  it.todo('answers only what the asker is allowed to see');
  it.todo('applies each criterion of the query');
});
