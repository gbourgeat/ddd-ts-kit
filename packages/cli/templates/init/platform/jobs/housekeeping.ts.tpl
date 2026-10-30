/**
 * How long the platform keeps what it is done with, in days, read from the environment by
 * `load-config.ts`. A row holds what its payload held: {{#if events.outbox}}`events.purge-published` drops the records of the
 * outbox past that age{{/if}}{{#if events.outbox}}{{#if queue.stored}}, {{/if}}{{/if}}{{#if queue.stored}}`jobs.purge-finished` the jobs that succeeded or were cancelled{{/if}}, every night. What failed for
 * good stays until an operator decides.
 */
export interface Housekeeping {
{{#if events.outbox}}
  readonly publishedEventsDays: number;
{{/if}}
{{#if queue.stored}}
  readonly finishedJobsDays: number;
{{/if}}
}

/** Left out (the tools, the tests), thirty days of each. */
export const DEFAULT_HOUSEKEEPING: Housekeeping = {
{{#if events.outbox}}
  publishedEventsDays: 30,
{{/if}}
{{#if queue.stored}}
  finishedJobsDays: 30,
{{/if}}
};
