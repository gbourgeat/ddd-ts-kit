import { Gateway } from '@ddd-ts-kit/kernel/declarations';
import { PersonDirectoryContract } from '@/contexts/identity/published-language';
import { PersonDirectoryGateway } from '@/contexts/scheduling/application/calendars/ports/person-directory-gateway.port';

// TODO(platform): when identity runs as its own service, turn this class into the remote adapter of PersonDirectoryGateway (an HTTP or RPC client with a timeout, retries and a fallback): the declaration stays, nothing else changes.
@Gateway(PersonDirectoryGateway)
export class InProcessPersonDirectoryGateway implements PersonDirectoryGateway {
  constructor(readonly upstream: PersonDirectoryContract) {}

  async namesOf(personIds: readonly string[]): Promise<ReadonlyMap<string, { readonly displayName: string }>> {
    const cards = await this.upstream.byIds(personIds);

    return new Map(cards.map((card) => [card.personId, { displayName: card.displayName }]));
  }
}
