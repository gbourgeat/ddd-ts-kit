import type { UseCaseDeclaration } from '@ddd-ts-kit/auth';
{{#if http.any}}
import type { Route } from '@ddd-ts-kit/http';
{{/if}}
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** What the module {{module.kebab}} of the model registers; {{context.kebab}}.module.ts composes it with the rest of the context. */
export const {{module.camel}}Module = {
  /** The command and query handlers of the module, with the repositories and readers they are given. */
  registerHandlers(platform: Platform): void {
    // ddd-ts-kit:handlers
    // /ddd-ts-kit:handlers
  },

  /** What the module does when an event happens: its own events and those of the other contexts. */
  registerReactions(platform: Platform): void {
    // ddd-ts-kit:reactions
    // /ddd-ts-kit:reactions
  },

  /** The jobs of the module, scheduled and in the background. */
  registerJobs(platform: Platform): void {
    // ddd-ts-kit:jobs
    // /ddd-ts-kit:jobs
  },

  /** What each use case of the module requires, or that it is public. */
  useCases(): UseCaseDeclaration[] {
    return [
      // ddd-ts-kit:authorization
      // /ddd-ts-kit:authorization
    ];
  },
  {{#if http.any}}

  /** The routes the module answers, over the buses of the platform. */
  routes(platform: Platform): Route[] {
    return [
      // ddd-ts-kit:routes
      // /ddd-ts-kit:routes
    ];
  },
  {{/if}}
};
