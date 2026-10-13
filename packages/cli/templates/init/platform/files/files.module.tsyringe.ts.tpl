import { defineContextModule, type ContextModule } from '@ddd-ts-kit/di';
import { Clock, FileStaging, PurgeStagedFiles, type FileStorage } from '@ddd-ts-kit/kernel';
import { bindFiles } from '{{alias.platform}}/files/bind-files{{alias.ext}}';

/**
 * Files as a capability of the platform: the storage `main.ts` opened (the memory of the process
 * for the tools and the tests), its ports, and the hourly purge of what rolled-back commands left
 * in `staging/`.
 */
export function filesModule(storage: FileStorage): ContextModule {
  return defineContextModule({
    name: 'files',
    register(builder) {
      bindFiles(builder, storage);
      builder.job('files.purge-staged', { every: '1h' }).handledBy(PurgeStagedFiles, [FileStaging, Clock]);
    },
  });
}
