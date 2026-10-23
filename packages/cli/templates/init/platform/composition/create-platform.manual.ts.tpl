import { PolicyAccess } from '@ddd-ts-kit/auth';
import {
  InMemoryDomainEventDispatcher,
{{#if files.any}}
  InMemoryFileStorage,
{{/if}}
{{#if errors.none}}
  NoopErrorReporter,
{{/if}}
  ScopedActorContext,
  dispatchingOnSave,
  reportAfterCommitFailures,
  type DomainEventDispatcher,
} from '@ddd-ts-kit/kernel';
import type { TracedApplication } from '@ddd-ts-kit/tracing';
import { accessPolicies } from '{{alias.platform}}/auth/authorization/access-policies{{alias.ext}}';
import { createAuthorizer } from '{{alias.platform}}/auth/authorization/create-authorizer{{alias.ext}}';
import { UseCaseProtection } from '{{alias.platform}}/auth/authorization/use-case-protection{{alias.ext}}';
import { createCommandBus } from '{{alias.platform}}/buses/create-command-bus{{alias.ext}}';
import { createQueryBus } from '{{alias.platform}}/buses/create-query-bus{{alias.ext}}';
{{#if files.any}}
import { layFoundations, type Foundations } from '{{alias.platform}}/composition/lay-foundations{{alias.ext}}';
{{/if}}
{{#unless files.any}}
import { layFoundations } from '{{alias.platform}}/composition/lay-foundations{{alias.ext}}';
{{/unless}}
import type { Platform } from '{{alias.platform}}/composition/platform{{alias.ext}}';
import type { PlatformOptions } from '{{alias.platform}}/composition/platform-options{{alias.ext}}';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import { platformEvents } from '{{alias.platform}}/events/platform-events{{alias.ext}}';
{{#if files.any}}
import { createFiles, type Files } from '{{alias.platform}}/files/create-files{{alias.ext}}';
{{/if}}
import { adapterAspects } from '{{alias.platform}}/resilience/adapter-aspects{{alias.ext}}';
import { defaultResilience } from '{{alias.platform}}/resilience/default-resilience{{alias.ext}}';
import { ownPolicy } from '{{alias.platform}}/resilience/own-policy{{alias.ext}}';
import type { ResilienceSettings } from '{{alias.platform}}/resilience/resilience-settings{{alias.ext}}';

/**
 * The platform, assembled: the foundations, the domain events, the guard of the use cases, the
 * two buses, the event ports{{#if files.any}}, the files{{/if}} and what every adapter is wrapped in. Replacing a provider
 * (another broker, another clock) happens here and nowhere else.
 */
export function createPlatform(persistence: Persistence, options: PlatformOptions): Platform {
  const foundations = layFoundations(persistence, options);
{{#if audit.on}}
  const { traced, ...founded } = foundations;
  const onDecision = foundations.audit.decisions;
{{/if}}
{{#unless audit.on}}
  const { traced, decisions: onDecision, ...founded } = foundations;
{{/unless}}
  const { clock, logger, scope } = foundations;
  // A handler of the after-commit phase that fails is logged{{#if errors.sentry}} and reported{{/if}}: the command it follows is committed, and answers.
{{#if errors.none}}
  const afterCommitFailed = reportAfterCommitFailures({ reporter: new NoopErrorReporter(), logger, scope });
{{/if}}
{{#if errors.sentry}}
  const afterCommitFailed = reportAfterCommitFailures({ reporter: foundations.errors, logger, scope });
{{/if}}
  const domainEvents = traced.domainEvents(new InMemoryDomainEventDispatcher(afterCommitFailed));
  const authorizer = createAuthorizer();
  const protection = new UseCaseProtection(authorizer, onDecision);
  const adapter = adapterOf(options.resilience ?? defaultResilience, { traced, domainEvents });
{{#if files.any}}
  const files = filesOf(options, foundations);
{{/if}}

  return {
    ...founded,
    ...platformEvents(persistence, options, foundations),
    commands: createCommandBus(foundations, { guard: protection.guard, persistence{{#if files.any}}, files{{/if}}{{#if cache.relaySignal}}, redis: options.redis{{/if}} }),
    queries: createQueryBus(foundations, protection.guard),
    domainEvents,
    persistence,
    access: new PolicyAccess({ authorizer, clock, policies: accessPolicies, onDecision }),
    actors: new ScopedActorContext(scope, foundations.ids),
    adapter,
    selfGoverned: (instance, info) => adapter(ownPolicy()(instance, info), info),
    protection,
{{#if files.any}}
    files,
{{/if}}
  };
}
{{#if files.any}}

/** Where the content of files lives: the storage of `main.ts`; left out (the tools, the tests), the memory of the process. */
function filesOf(options: PlatformOptions, foundations: Foundations): Files {
{{#if errors.none}}
  return createFiles(options.files ?? new InMemoryFileStorage(), { ...foundations, errors: new NoopErrorReporter() });
{{/if}}
{{#if errors.sentry}}
  return createFiles(options.files ?? new InMemoryFileStorage(), foundations);
{{/if}}
}
{{/if}}

interface Outside {
  readonly traced: TracedApplication;
  readonly domainEvents: DomainEventDispatcher;
}

/**
 * Around every adapter, outermost first: its span, for a repository the dispatch of the domain
 * events of what it saves (handlers only save), then the retries and the time limit of what
 * leaves the process.
 */
function adapterOf(settings: ResilienceSettings, { traced, domainEvents }: Outside): Platform['adapter'] {
  const resilient = adapterAspects(settings);

  return (instance, info) => {
    const governed = resilient(instance, info);
    const saving = info.kind === 'repository' ? dispatchingOnSave(governed, () => domainEvents) : governed;

    return traced.binding(saving, { ...info, context: info.context ?? 'platform' });
  };
}
