import { describe, expect, it } from 'vitest';
import { defineContextModule, fake } from '@ddd-ts-kit/di';
import { Access, Authorizer, PolicyAccess } from '../src/index.js';
import { AllowAll } from '../src/testing.js';
import { docsPermissions } from './fixtures/docs/application/authorization/docs.permissions.js';
import { ShareDocument } from './fixtures/docs/application/commands/share-document/share-document.command.js';
import { DocumentRepository } from './fixtures/docs/domain/repositories/document.repository.js';

const share = docsPermissions['document.share'];

class ShareOwnedDocumentHandler {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly access: Access,
  ) {}

  async execute(command: ShareDocument): Promise<void> {
    const document = await this.documents.findById(command.documentId);

    await this.access.authorize(command.actor, share, document);
  }
}

describe('injecting the ports of authorization', () => {
  it('names Access in the dependency list, at the place the constructor expects it', () => {
    const sharing = defineContextModule({
      name: 'sharing',
      register(builder) {
        builder.command(ShareDocument).requires(share).handledBy(ShareOwnedDocumentHandler, [DocumentRepository, Access]);
      },
    });

    expect(sharing.name).toBe('sharing');
  });

  it('is refused by the compiler when Access is named in the wrong place', () => {
    const swapped = defineContextModule({
      name: 'swapped',
      register(builder) {
        // @ts-expect-error -- the constructor expects the repository first, then Access
        builder.command(ShareDocument).requires(share).handledBy(ShareOwnedDocumentHandler, [Access, DocumentRepository]);
      },
    });

    expect(swapped.name).toBe('swapped');
  });

  it('is refused by the compiler when Authorizer is named where Access is expected', () => {
    const confused = defineContextModule({
      name: 'confused',
      register(builder) {
        // @ts-expect-error -- an Authorizer checks requests, it does not authorize a loaded subject
        builder.command(ShareDocument).requires(share).handledBy(ShareOwnedDocumentHandler, [DocumentRepository, Authorizer]);
      },
    });

    expect(confused.name).toBe('confused');
  });

  it('is refused by the compiler when the implementation is named instead of its port', () => {
    const coupled = defineContextModule({
      name: 'coupled',
      register(builder) {
        // @ts-expect-error -- PolicyAccess is an implementation: a dependency list names the port, Access
        builder.command(ShareDocument).requires(share).handledBy(ShareOwnedDocumentHandler, [DocumentRepository, PolicyAccess]);
      },
    });

    expect(coupled.name).toBe('coupled');
  });

  it('accepts as a fake of Authorizer only what can check', () => {
    // @ts-expect-error -- a fake that lists but cannot check is no Authorizer
    const partial = fake(Authorizer, { listAccessible: async () => ({ kind: 'all' }) });
    const complete = fake(Authorizer, new AllowAll());

    expect([partial, complete]).toHaveLength(2);
  });
});
