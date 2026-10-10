import { Clock } from '@ddd-ts-kit/kernel';
import { defineContextModule } from '../../../src/index.js';
import { EpochClock } from './epoch-clock.js';

/** A clock and nothing else: these modules run without the kernel module. */
export const platform = defineContextModule({
  name: 'platform',
  register(builder) {
    builder.bind(Clock).toClass(EpochClock);
  },
});
