// class-transformer ships this module without a declaration next to it.
declare module 'class-transformer/cjs/storage.js' {
  import type { MetadataStorage } from 'class-transformer/types/MetadataStorage.js';
  export const defaultMetadataStorage: MetadataStorage;
}
