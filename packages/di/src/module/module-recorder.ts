import type {
  Command,
  DependencyKind,
  Message,
  MessageInfo,
  MessageType,
  Query,
  ScheduledJob,
} from '@ddd-ts-kit/kernel';
import {
  describeToken,
  type Dependencies,
  type EventContract,
  type IntegrationEventHandler,
  type MessageHandler,
  type ScheduledOptions,
  type Token,
} from '@ddd-ts-kit/kernel/declarations';
import { declaredRequirement } from '../authorization/declared-requirement.js';
import { protectedRequirement } from '../authorization/protected-requirement.js';
import { PUBLIC_REQUIREMENT, type Requirement } from '../authorization/requirement.js';
import type { ConsumerOptions } from '../consumer/consumer-options.js';
import { consumptionOf } from '../declared/consumption-of.js';
import type { DeclaredSource } from '../declared/declared-source.js';
import { includeDeclared } from '../declared/include-declared.js';
import { WiringError } from '../errors/wiring-error.js';
import { writtenJob } from '../jobs/written-job.js';
import { assertPort } from '../wiring/assert-port.js';
import type { Binding } from '../wiring/binding.js';
import { naturalKind } from '../wiring/natural-kind.js';
import { classRecipe, factoryRecipe, valueRecipe, type Recipe } from '../wiring/recipe.js';
import type { WiringDraft } from '../wiring/wiring-draft.js';
import { bindingOptionsOf } from './binding-options-of.js';
import type { BindingOptions } from './binding-options.js';
import type { BindingTarget } from './binding-target.js';
import { integrationEventHandlerOf, jobOf, messageHandlerOf } from './factory-made-handlers.js';
import type { HandlerTarget } from './handler-target.js';
import type { ModuleBuilder } from './module-builder.js';
import type { ProtectedUseCaseTarget } from './protected-use-case-target.js';

interface HandlerStatement<Handler> {
  /** The statement as the module wrote it, for error messages and factory handler names. */
  readonly statement: string;
  readonly kind: DependencyKind;
  /** What a handler built by a factory is bound under: no class of the project names it. */
  readonly factoryMade: Token<Handler>;
  record(handler: Token<Handler>): void;
}

/** The builder a module registers on: every statement goes to the draft, under the name of the module. */
export class ModuleRecorder implements ModuleBuilder {
  private readonly unfinished = new Set<symbol>();

  constructor(
    private readonly module: string,
    private readonly draft: WiringDraft,
  ) {}

  // The builder methods are arrow properties: a `register` function may destructure them.
  readonly bind = <T>(port: Token<T>): BindingTarget<T> => this.bindingTarget('bind', port);

  readonly rebind = <T>(port: Token<T>): BindingTarget<T> => this.bindingTarget('rebind', port);

  readonly command = <C extends Command<unknown>>(type: MessageType<C>): ProtectedUseCaseTarget<C> =>
    this.useCase('command', type);

  readonly query = <Q extends Query<unknown>>(type: MessageType<Q>): ProtectedUseCaseTarget<Q> =>
    this.useCase('query', type);

  readonly on = <Payload>(
    contract: EventContract<Payload>,
    options: ConsumerOptions,
  ): HandlerTarget<IntegrationEventHandler<Payload>> =>
    this.handlerTarget<IntegrationEventHandler<Payload>>({
      statement: `on(${contract.type})`,
      kind: 'consumer',
      factoryMade: integrationEventHandlerOf<Payload>(`on(${contract.type})`),
      record: (handler) => {
        this.draft.addConsumption(consumptionOf({ contract, options, handler, module: this.module }));
      },
    });

  readonly job = (name: string, settings: ScheduledOptions): HandlerTarget<ScheduledJob> =>
    this.handlerTarget<ScheduledJob>({
      statement: `job(${name})`,
      kind: 'job',
      factoryMade: jobOf(`job(${name})`),
      record: (job) => {
        this.draft.addJob(writtenJob(name, settings, { job, module: this.module }));
      },
    });

  readonly include = (declared: DeclaredSource): void => {
    includeDeclared({ draft: this.draft, module: this.module }, declared);
  };

  readonly around: ModuleBuilder['around'] = (kinds, aspect) => {
    this.draft.addKindAspect({ kinds, aspect, module: this.module });
  };

  assertNothingLeftUnfinished(): void {
    const [statement] = this.unfinished;

    if (statement !== undefined) {
      throw new WiringError('INCOMPLETE_BINDING', `Module "${this.module}" calls ${statement.description}.`);
    }
  }

  private bindingTarget<T>(verb: 'bind' | 'rebind', port: Token<T>): BindingTarget<T> {
    const finish = this.begin(`${verb}(${describeToken(port)}) without toClass, toFactory or toValue`);

    const add = (recipe: Recipe): BindingOptions => {
      finish();

      const binding = this.bindingOf(port, recipe);

      if (verb === 'bind') {
        this.draft.addBinding(binding);
      } else {
        this.draft.replaceBinding(binding);
      }

      return bindingOptionsOf(binding);
    };

    return {
      toClass: (implementation: new (...args: never) => T, ...rest: readonly [dependencies?: Dependencies]) => {
        assertPort(port, implementation, this.module);

        return add(classRecipe(implementation, rest[0]));
      },
      toFactory: (factory) => add(factoryRecipe(factory)),
      toValue: (value) => add(valueRecipe(value)),
    };
  }

  private begin(statement: string): () => void {
    const unfinished = Symbol(statement);

    this.unfinished.add(unfinished);

    return () => void this.unfinished.delete(unfinished);
  }

  private bindingOf(target: Token<unknown>, recipe: Recipe): Binding {
    const kind = naturalKind(target);

    return {
      token: target,
      module: this.module,
      lifetime: 'singleton',
      aspects: [],
      ...recipe,
      ...(kind === undefined ? {} : { kind }),
    };
  }

  private useCase<M extends Message>(kind: MessageInfo['kind'], message: MessageType<M>): ProtectedUseCaseTarget<M> {
    let requirement = declaredRequirement(message);
    const statement = `${kind}(${message.name})`;

    const target = this.handlerTarget<MessageHandler<M>>({
      statement,
      kind: 'use-case',
      factoryMade: messageHandlerOf<M>(statement),
      record: (handler) => {
        this.draft.addHandling({ kind, message, handler, module: this.module, requirement });
      },
    });

    const declaring = (declared: Requirement): HandlerTarget<MessageHandler<M>> => {
      requirement = declared;

      return target;
    };

    return {
      ...target,
      requires: (permission, options) => declaring(protectedRequirement(message, permission, options)),
      public: () => declaring(PUBLIC_REQUIREMENT),
    };
  }

  private handlerTarget<Handler>(declaration: HandlerStatement<Handler>): HandlerTarget<Handler> {
    const { statement, kind, factoryMade } = declaration;
    const finish = this.begin(`${statement} without handledBy or handledByFactory`);

    const add = (handler: Token<Handler>, recipe: Recipe): void => {
      finish();
      declaration.record(handler);
      this.draft.addBinding({ ...this.bindingOf(handler, recipe), kind });
    };

    return {
      handledBy: (implementation: new (...args: never) => Handler, ...rest: readonly [dependencies?: Dependencies]) => {
        add(implementation, classRecipe(implementation, rest[0]));
      },
      handledByFactory: (factory) => {
        add(factoryMade, factoryRecipe(factory));
      },
    };
  }
}
