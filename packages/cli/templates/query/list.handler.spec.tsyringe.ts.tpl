import { describe, expect, it } from '{{tests.module}}';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { createTestApplication, fake } from '@ddd-ts-kit/di';
import { offsetPage } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '{{paths.integrationToPlatform}}/platform.module.js';
import { {{name.pascal}}Query, type {{name.pascal}}Item } from '../../application/queries/{{name.kebab}}/{{name.kebab}}.query.js';
import { {{spec.moduleNames}} } from '../../{{context.kebab}}.module.js';
import { Fake{{name.pascal}}Reader } from '../fakes/{{name.kebab}}-reader.fake.js';

const holders = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: { holder: [{{context.camel}}Permissions['{{access.permission}}']] } }) });
const holder = anActor().withRole('holder').build();
const LINES: readonly {{name.pascal}}Item[] = [{ id: '{{list.resource}}-1' }, { id: '{{list.resource}}-2' }, { id: '{{list.resource}}-3' }];

describe('{{name.title}}', () => {
  it('answers one page of what the actor may see, with the total', async () => {
    const application = arrange(LINES);

    const page = await application.queryBus.execute(new {{name.pascal}}Query(holder, offsetPage({ limit: 2 })));

    expect(page).toEqual({ items: LINES.slice(0, 2), total: 3 });
  });

  it('is refused to an actor who does not hold the permission {{access.permission}}', async () => {
    const application = arrange(LINES);

    await expect(application.queryBus.execute(new {{name.pascal}}Query(anActor().build(), offsetPage()))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // TODO(domain): replace each entry below by a test named after what "{{name.words}}" shows and to whom.
  it.todo('lists only what the access scope of the actor covers');
  it.todo('applies each criterion of the query');
});

function arrange(lines: readonly {{name.pascal}}Item[]) {
  return createTestApplication({
    modules: [{{spec.modules}}],
    fakes: [fake({{name.constant}}_READER, new Fake{{name.pascal}}Reader(lines))],
  });
}
