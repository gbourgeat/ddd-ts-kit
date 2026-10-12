import { describe } from 'vitest';
import { adapterClient } from './adapter-client.js';
import { answersAsDeclared } from './behaviour-answers.js';
import { mountsControllers } from './behaviour-controllers.js';
import { refusesDuplicates } from './behaviour-duplicates.js';
import { carriesIdentifiers } from './behaviour-identifiers.js';
import { answersProblems } from './behaviour-problems.js';
import type { ReadAuthorization, StartServer } from './running-server.js';

/** The one suite every adapter must pass: the behaviour belongs to the pipeline, not the framework. */
export function describeAdapter(name: string, start: StartServer, readAuthorization: ReadAuthorization): void {
  describe(`routes mounted on ${name}`, () => {
    const client = adapterClient(start, readAuthorization);

    answersAsDeclared(client);
    carriesIdentifiers(client);
    answersProblems(client);
    refusesDuplicates(start);
    mountsControllers(start, readAuthorization);
  });
}
