import type { PersonDirectoryGateway } from '#src/contexts/scheduling/application/ports/person-directory-gateway.port.js';

/** Answers the names a test gave it, and fails on demand as a remote directory may. */
export class FakePersonDirectoryGateway implements PersonDirectoryGateway {
  private failure: Error | undefined;

  constructor(private readonly names: Readonly<Record<string, string>> = {}) {}

  failNextWith(failure: Error): void {
    this.failure = failure;
  }

  async namesOf(personIds: readonly string[]): Promise<ReadonlyMap<string, { readonly displayName: string }>> {
    const failure = this.failure;

    this.failure = undefined;

    if (failure !== undefined) {
      throw failure;
    }

    return new Map(
      personIds.flatMap((personId) =>
        personId in this.names ? [[personId, { displayName: this.names[personId] ?? '' }] as const] : [],
      ),
    );
  }
}
