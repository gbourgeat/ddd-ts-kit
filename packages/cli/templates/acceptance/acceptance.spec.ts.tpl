{{#if tests.vitest}}
import { afterAll, beforeAll, beforeEach, describe, it, onTestFailed } from 'vitest';
{{/if}}
{{#if tests.jest}}
import { afterAll, beforeAll, beforeEach, describe, it } from '@jest/globals';
{{/if}}
{{#if tests.vitest}}
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';
{{/if}}
import { startApplication, type RunningApplication } from '{{alias.test}}/e2e/support/start-application{{alias.ext}}';

// The acceptance of {{story.id}}, written before its code: one scenario per acceptance criterion, as a client sees it through the API (routes, answers, integration events), never through a class of src/ nor the database. A scenario's title starts with the rows that make it pass, then the criterion it proves (`#{{story.example}} AC1 ...`); its body stays wrapped in `pending(...)` of `@ddd-ts-kit/testing/e2e` until they are built, and the commit of the last one removes the wrapper. Once written, `npx ddd-ts-kit acceptance {{story.id}} --lock`: a locked scenario then changes only with its criterion. `npx ddd-ts-kit acceptance {{story.id}} --gate written` says when the code may start.
// Rows to cover: {{story.rows}}.
describe('{{story.title}}, acceptance', () => {
  let application: RunningApplication;

  beforeAll(async () => {
    application = await startApplication();
  });

  afterAll(async () => {
    await application.close();
  });

  beforeEach(async () => {
    await application.reset();
  });
{{#if tests.vitest}}

  reportSeedOnFailure({ beforeEach, onTestFailed });
{{/if}}

  // TODO(domain): replace each entry by the scenarios of the acceptance criteria it covers, given / when / then, each one `it('#<row> <what the client observes>', pending(async () => { ... }))`, and run them (`npm run test:e2e -- test/acceptance`) to see each fail on an assertion.
{{story.todos}}
});
