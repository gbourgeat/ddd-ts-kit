import { defineContextModule } from '@ddd-ts-kit/di';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

export const {{context.camel}}Module = defineContextModule({
  name: '{{context.kebab}}',
  register(builder) {
    // ddd-ts-kit:registrations
    // /ddd-ts-kit:registrations
  },
  onStart({ resolve }) {
    // ddd-ts-kit:start
    // /ddd-ts-kit:start
  },
});
