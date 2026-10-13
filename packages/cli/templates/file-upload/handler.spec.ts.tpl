import { Readable } from 'node:stream';
import { describe, expect, it } from '{{tests.module}}';
{{#if access.protected}}
import { AuthorizationMap, RoleBasedAuthorizer, authorizationMiddleware, requires } from '@ddd-ts-kit/auth';
import { anActor } from '@ddd-ts-kit/auth/testing';
{{/if}}
import {
  AcceptEveryFileScanner,
  FileStaging,
  InMemoryErrorReporter,
  InMemoryFileStorage,
  TenantFileKeys,
  fileUploadsMiddleware,
} from '@ddd-ts-kit/kernel';
import { createTestBuses } from '@ddd-ts-kit/testing';
{{#if access.protected}}
import { {{context.camel}}Permissions } from '{{alias.context}}/application/authorization/{{context.kebab}}.permissions{{alias.ext}}';
{{/if}}
import { {{name.pascal}}Command } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.command{{alias.ext}}';
import { {{name.pascal}}Handler } from '{{alias.context}}/application/commands/{{name.kebab}}/{{name.kebab}}.handler{{alias.ext}}';
{{#if access.protected}}

const holders = authorizationMiddleware({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [{{context.camel}}Permissions['{{access.permission}}']] },
  }),
  map: AuthorizationMap.of(requires({{name.pascal}}Command, {{context.camel}}Permissions['{{access.permission}}'])),
});

const holder = anActor().withRole('holder').build();
{{/if}}

const PDF = '%PDF-1.7\n%%EOF\n';

describe('{{name.title}}', () => {
  it('keeps the file under a key of its own, visible once the command has committed', async () => {
    const { commandBus, storage } = arrange();

    const key = await commandBus.execute(new {{name.pascal}}Command({{#if access.protected}}holder, {{/if}}aFile()));

    expect(storage.keys()).toEqual([key]);
    expect(await storage.stat(key)).toMatchObject({ size: PDF.length, mediaType: 'application/pdf' });
  });
  {{#if access.protected}}

  it('is refused to an actor who does not hold the permission {{access.permission}}, and keeps nothing', async () => {
    const { commandBus, storage } = arrange();
    const command = new {{name.pascal}}Command(anActor().build(), aFile());

    await expect(commandBus.execute(command)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(storage.keys()).toEqual([]);
  });
  {{/if}}

  // TODO(domain): replace each entry below by a test named after the business behaviour of "{{name.words}}": the reference recorded on the aggregate, the refusal that rolls the command back and leaves only a staged file.
  it.todo('records the reference of the file on the aggregate it is attached to');
  it.todo('leaves no visible file when the command is refused');
});

function aFile() {
  return { fileName: 'scan.pdf', mediaType: 'application/pdf', stream: Readable.from([Buffer.from(PDF)]) };
}

function arrange() {
  const { commandBus, clock, ids } = createTestBuses({ idPrefix: 'file' });
  const storage = new InMemoryFileStorage({ clock });
  const staging = new FileStaging(storage, new AcceptEveryFileScanner(), new InMemoryErrorReporter());

  const keys = new TenantFileKeys(ids, clock);

  commandBus
{{#if access.protected}}
    .use(holders)
{{/if}}
    .use(fileUploadsMiddleware(() => ({ keys, staging })))
    .register({{name.pascal}}Command, new {{name.pascal}}Handler(staging));

  return { commandBus, storage };
}
