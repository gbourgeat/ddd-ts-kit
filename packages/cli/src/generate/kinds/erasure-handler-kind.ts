import { CliError } from '../../cli-error';
import { MissingPrerequisite } from '../missing-prerequisite';
import type { Scope } from '../scope';
import { emit } from '../emit';
import { isDeclared } from '../is-declared';
import type { Kind } from '../kind';
import { openScope } from '../open-scope';
import { vars } from '../vars';
import { wire } from '../wire';
import { personalNames, type PersonalNames } from './personal-data/personal-names';

export const erasureHandlerKind: Kind = {
  name: 'erasure-handler',
  aliases: [],
  usage: 'erasure-handler <context>',
  summary:
    'The idempotent handler of privacy.data-subject.erased that erases what the context keeps of the person through its PersonalDataErasure, its spec and its subscription: for a context that runs as a service of its own, or that copies personal data from integration events.',
  positionals: ['context'],
  writesShared: false,
  writesInModules: true,
  run: (request) => {
    const scope = openScope(request);
    const names = personalNames(scope.config.stack.orm, scope.context);
    const adapter = erasureAdapterOf(scope, names);
    const external = scope.config.stack.broker !== 'none';

    const context = vars(scope, {
      personal: { names: { ...names } },
      tenant: { scoped: adapter.includes('scope: ExecutionScope)') },
      consumer: {
        transactional: external,
        subscriber: external ? `platform.subscriberFor('${scope.context.kebab}')` : 'platform.subscriber',
      },
    });

    emit(scope, context, [
      [
        `erasure-handler/erasure-handler${isDeclared(scope.config) ? '.declared' : ''}.ts.tpl`,
        'application/integration/handlers/data-subject-erased.integration-handler.ts',
      ],
      ['erasure-handler/erasure-handler.spec.ts.tpl', 'test/unit/data-subject-erased.integration-handler.spec.ts'],
    ]);

    wire(scope, 'erasure-handler', context);
  },
};

/** The erasure the handler calls: the one `generate repository --personal` wrote for the context, or nothing to call. */
function erasureAdapterOf(scope: Scope, names: PersonalNames): string {
  const file = `${scope.dir}/infrastructure/persistence/${names.adapterKebab}.repository.ts`;
  const adapter = scope.ws.read(file);

  if (adapter === undefined && isEventSourced(scope)) {
    throw new CliError(
      `${scope.context.kebab} is event-sourced: it has no table to erase, and no handler to write.`,
      `Its personal values are sealed in the events by \`personalData(subjectId, value)\` in the codec of the stored events, and \`npm run privacy:erase -- <subject-id>\` (\`eraseDataSubject\` of the kernel) destroys the key of the subject in the key store, which erases them in every context at once (docs/concepts/personal-data.md, docs/concepts/event-sourcing.md). A projection that keeps a clear copy is rebuilt after the erasure. An erasure on a date of the business (a retention) calls the same key destruction from a scheduled job of your own. A handler of \`privacy.data-subject.erased\` is for a table: declare it with \`generate repository ${scope.context.kebab} <Aggregate> --personal <column>,...\` on a plain aggregate.`,
    );
  }

  if (scope.config.stack.privacy !== 'on' || adapter === undefined) {
    // On a project that keeps personal data, the repository that declares it is written by an earlier command.
    const Refusal = scope.config.stack.privacy === 'on' ? MissingPrerequisite : CliError;

    throw new Refusal(
      `${scope.context.kebab} has no erasure of personal data to run when the platform announces one.`,
      `Declare what a table of ${scope.context.kebab} keeps of a person first, with \`ddd-ts-kit generate repository ${scope.context.kebab} <Aggregate> --personal <column>,...\` (on a project with \`stack.privacy\` on: \`ddd-ts-kit init --force --privacy on\`), then run the command again.`,
    );
  }

  scope.flags.builtOn?.(scope.ws.placed(file));

  return adapter;
}

/** An event-sourced aggregate leaves the codec of its stored events in the persistence of the context, and no table. */
function isEventSourced(scope: Scope): boolean {
  return scope.ws.list(`${scope.dir}/infrastructure/persistence`).some((file) => file.endsWith('-events.mapper.ts'));
}
