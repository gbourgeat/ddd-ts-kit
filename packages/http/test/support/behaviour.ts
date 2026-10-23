import { describe } from 'vitest';
import { adapterClient } from './adapter-client';
import { answersAsDeclared } from './behaviour-answers';
import { mountsControllers } from './behaviour-controllers';
import { refusesDuplicates } from './behaviour-duplicates';
import { carriesIdentifiers } from './behaviour-identifiers';
import { answersProblems } from './behaviour-problems';
import { answersInSeveralMediaTypes } from './behaviour-representations';
import type { ReadAuthorization, StartServer } from './running-server';

/** The one suite every adapter must pass: the behaviour belongs to the pipeline, not the framework. */
export function describeAdapter(name: string, start: StartServer, readAuthorization: ReadAuthorization): void {
  describe(`routes mounted on ${name}`, () => {
    const client = adapterClient(start, readAuthorization);

    answersAsDeclared(client);
    carriesIdentifiers(client);
    answersProblems(client);
    refusesDuplicates(start);
    mountsControllers(start, readAuthorization);
    answersInSeveralMediaTypes(start);
  });
}
