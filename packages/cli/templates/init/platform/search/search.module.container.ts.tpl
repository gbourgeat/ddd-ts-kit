import { defineContextModule, type ContextModule } from '@ddd-ts-kit/di';
import { SearchIndexes } from '{{alias.platform}}/search/search-indexes{{alias.ext}}';

/**
 * The read models of OpenSearch as a capability of the platform: `SearchIndexes`, which the
 * adapter of a read model port names in its constructor, and the provisioning of the index of
 * every store built by then, at the start.
 */
export function searchModule(search: SearchIndexes): ContextModule {
  return defineContextModule({
    name: 'search',
    register(builder) {
      builder.bind(SearchIndexes).toValue(search);
    },
    onStart: () => search.provision(),
  });
}
