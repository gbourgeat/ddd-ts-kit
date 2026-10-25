[English](README.md) · **Français**
<!-- translation-of: README.md sha256:2d64ed4c1b28d4b6 -->

# @ddd-ts-kit/di

Des modules de contexte au-dessus de [tsyringe](https://github.com/microsoft/tsyringe), pour les
projets qui veulent l'injection de dépendances sans un framework lourd.

Un port est une classe abstraite, et c'est par cette classe que l'on injecte. Une classe dit ce
qu'elle est, et le contexte est assemblé à partir de ce que disent ses classes : aucun fichier de
liaisons à tenir en phase avec le code, aucune constante qui tienne lieu de port. Le module
explicite, où chaque liaison est écrite à la main, reste pris en charge et se mêle au style
déclaré dans une même application.

```
npm i @ddd-ts-kit/di tsyringe reflect-metadata
```

`reflect-metadata` est importé par ce *package* avant le chargement de tsyringe (tsyringe refuse
de se charger sans lui), si bien que vous ne l'importez pas vous-même. Aucun décorateur du kit
n'en a besoin : les dépendances sont nommées, jamais déduites par réflexion.

![Comment les classes d'un contexte délimité deviennent une application en marche : le contexte déclare ses ports et ses classes (ou écrit un module explicite), un module est fait par contexte par contextModule, discoverContext ou defineContextModule, et createApplication enregistre les modules, vérifie le graphe entier, lie tout dans un conteneur enfant et ne démarre rien ; puis un appel à part, app.start, abonne les consommateurs et démarre les jobs](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/di-assembly.fr.svg)

Quel que soit le style, le chemin est le même : les classes d'un contexte disent ce qu'elles
sont, un module les rassemble, et `createApplication` vérifie le graphe entier avant de
construire la moindre instance.

## Une première application

La plus petite application, en un seul fichier : un port, son adaptateur, une commande et son
gestionnaire (handler), le module qui les relie, et la racine de composition. Elle est écrite
dans le style explicite, pour que chaque liaison soit visible ; le style déclaré, plus bas, écrit
la même chose sans fichier de module.

<!-- checked sample -->
```ts
// src/main.ts : une application entière dans un seul fichier, à lire de haut en bas.
import { Clock, Command, CommandBus, IdGenerator, type CommandHandler } from '@ddd-ts-kit/kernel';
import { createApplication, defineContextModule, kernelModule } from '@ddd-ts-kit/di';

// Un port : une classe abstraite. Elle type le paramètre et sert de clé au conteneur.
export abstract class StockGateway {
  abstract reserve(sku: string): Promise<void>;
}

// Un adaptateur implémente son port ; il ne l'étend jamais.
export class InMemoryStock implements StockGateway {
  readonly reserved: string[] = [];

  async reserve(sku: string): Promise<void> {
    this.reserved.push(sku);
  }
}

export class PlaceOrder extends Command<string> {
  constructor(readonly sku: string) {
    super();
  }
}

// Le gestionnaire dit ce dont il a besoin dans son constructeur, et rien d'autre.
export class PlaceOrderHandler implements CommandHandler<PlaceOrder> {
  constructor(
    private readonly stock: StockGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: PlaceOrder): Promise<string> {
    await this.stock.reserve(command.sku);

    return `${this.ids.next()}@${this.clock.now().toISOString()}`;
  }
}

// Le module dit quel adaptateur répond à un port, et quel gestionnaire exécute une commande.
export const orderingModule = defineContextModule({
  name: 'ordering',
  register(builder) {
    builder.bind(StockGateway).toClass(InMemoryStock).as('gateway');
    builder.command(PlaceOrder).handledBy(PlaceOrderHandler, [StockGateway, IdGenerator, Clock]);
  },
});

// La racine de composition. kernelModule() lie Clock, IdGenerator, les bus, l'unité de travail...
const app = createApplication({ modules: [kernelModule(), orderingModule] });

await app.start();

const orderId: string = await app.resolve(CommandBus).execute(new PlaceOrder('sku-1'));

console.log(orderId);

await app.stop();
```

La liste `[StockGateway, IdGenerator, Clock]` est vérifiée par le compilateur contre le
constructeur de `PlaceOrderHandler` : un port manquant, en trop ou mal placé ne compile pas (voir
« Ce que vérifie le compilateur »). La *spec* du gestionnaire remplace l'adaptateur par un *fake*
et tourne sur un kernel déterministe, une horloge figée et des identifiants `id-1`, `id-2`... :

<!-- checked sample -->
```ts
// src/contexts/ordering/test/unit/place-order.handler.spec.ts
import { expect, it } from 'vitest';
import { Command } from '@ddd-ts-kit/kernel';
import { createTestApplication, fake, type ContextModule } from '@ddd-ts-kit/di';

// Ce que la spec importe du contexte, déclaré ici pour que l'exemple compile seul.
declare abstract class StockGateway {
  abstract reserve(sku: string): Promise<void>;
}
declare class PlaceOrder extends Command<string> {
  readonly sku: string;
  constructor(sku: string);
}
declare const orderingModule: ContextModule;

it('reserves the stock of the order it places', async () => {
  const reserved: string[] = [];

  const app = createTestApplication({
    modules: [orderingModule],
    fakes: [fake(StockGateway, { reserve: async (sku) => void reserved.push(sku) })],
  });

  const orderId = await app.commandBus.execute(new PlaceOrder('sku-1'));

  expect(reserved).toEqual(['sku-1']);
  expect(orderId).toBe('id-1@2026-01-01T00:00:00.000Z');
});
```

Le module est l'unité testée : pas de `new PlaceOrderHandler(...)` écrit à la main, pas de
`vi.mock`. Le *fake* est un littéral d'objet, puisqu'un port n'est qu'une forme.
Quand plusieurs *specs* d'un contexte construisent la même application de test,
`npx ddd-ts-kit generate test-world <context>` l'écrit une fois, dans `test/worlds/`, avec chaque
*fake* de `test/fakes/` : voir [Mondes](../../docs/concepts/testing-strategy.fr.md#mondes).

## Un contexte qui se déclare lui-même

Les décorateurs viennent de `@ddd-ts-kit/kernel/declarations`, qui ne contient aucun conteneur :
la couche application importe le kernel et rien d'autre. Ce *package* transforme les
déclarations en liaisons ; rien d'autre ne le fait. Le domaine ne porte aucun décorateur.

Un port vit là où vit la couche qui le possède : un port de *repository* dans
`domain/repositories/`, tout autre port dans `application/ports/`, une classe abstraite par
fichier.

```ts
// contexts/billing/domain/repositories/invoice.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';

export abstract class InvoiceRepository extends Repository<Invoice> {
  abstract findUnpaidOf(customerId: string): Promise<readonly Invoice[]>;
}
```

```ts
// contexts/billing/application/ports/payment-gateway.port.ts
export abstract class PaymentGateway {
  abstract capture(invoiceId: string, amount: Money): Promise<PaymentReceipt>;
}
```

```ts
// contexts/billing/application/commands/issue-invoice/issue-invoice.command.ts
import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';

@Requires(permissions['invoice.issue'], {
  resource: (command: IssueInvoice) => ({ type: 'customer', id: command.customerId }),
})
export class IssueInvoice extends AuthorizedCommand<string> {
  constructor(actor: Actor, readonly customerId: string) {
    super(actor);
  }
}
```

```ts
// contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';

@CommandHandler(IssueInvoice)
export class IssueInvoiceHandler implements CommandHandler<IssueInvoice> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly payments: PaymentGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: IssueInvoice): Promise<string> {
    const invoice = Invoice.issue({ id: this.ids.next(), customerId: command.customerId, issuedAt: this.clock.now() });

    await this.invoices.save(invoice);

    return invoice.id;
  }
}
```

Le gestionnaire ne fait qu'enregistrer. L'enregistrement remet les événements du domaine que
l'agrégat a consignés, et l'unité de travail de la commande les distribue une fois que le
gestionnaire a rendu la main, avant la validation (commit) : voir « Événements du domaine et
unité de travail ».

```ts
// contexts/billing/application/queries/get-invoice/get-invoice.query.ts et .handler.ts
@Public()
export class GetInvoice extends Query<InvoiceView | undefined> {
  constructor(readonly invoiceId: string) {
    super();
  }
}

@QueryHandler(GetInvoice)
export class GetInvoiceHandler implements QueryHandler<GetInvoice> { /* ... */ }
```

```ts
// contexts/billing/application/integration/handlers/invoice-on-order-placed.integration-handler.ts
import { CommandBus, systemActor, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { OrderPlaced, type OrderPlacedPayload } from '@/contexts/ordering/published-language';

@IntegrationEventHandler(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' })
export class InvoiceOnOrderPlaced implements IntegrationEventHandler<OrderPlacedPayload> {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: IntegrationEvent<OrderPlacedPayload>): Promise<void> {
    await this.commands.execute(new IssueInvoice(systemActor('billing.invoice-on-order-placed'), event.payload.customerId));
  }
}
```

```ts
// contexts/billing/application/integration/publishers/invoice-issued.publisher.ts
import { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';

@DomainEventHandler(InvoiceIssued)
export class InvoiceIssuedPublisher implements DomainEventHandler<InvoiceIssued> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: InvoiceIssued): Promise<void> { /* publie billing.invoice.issued */ }
}
```

```ts
// contexts/billing/infrastructure/persistence/knex-invoice.repository.ts
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';

@Repository(InvoiceRepository)
export class KnexInvoiceRepository implements InvoiceRepository { /* ... */ }
```

```ts
// contexts/billing/infrastructure/external/http-payment.gateway.ts
import { Gateway } from '@ddd-ts-kit/kernel/declarations';
import { retry, timeout } from '@ddd-ts-kit/aspects';

@Gateway(PaymentGateway, { aspects: [retry({ attempts: 3 }), timeout(2000)] })
export class HttpPaymentGateway implements PaymentGateway { /* ... */ }
```

C'est tout le contexte. Il s'assemble en une ligne, de l'une de deux manières.

```ts
// main.ts, par découverte : aucun fichier du contexte ne nomme ses classes
import { CommandBus } from '@ddd-ts-kit/kernel';
import { createApplication, kernelModule } from '@ddd-ts-kit/di';
import { discoverContext } from '@ddd-ts-kit/di/discovery';

const billing = await discoverContext('billing', new URL('./contexts/billing/', import.meta.url));
const app = createApplication({ modules: [kernelModule(), platformModule, billing], authorization: 'required' });
await app.start();
const invoiceId = await app.resolve(CommandBus).execute(new IssueInvoice(actor, 'customer-1')); // typé string
```

```ts
// main.ts, par liste : un barrel généré par contexte, et rien d'autre
import { contextModule, createApplication, kernelModule } from '@ddd-ts-kit/di';
import * as billing from '@/contexts/billing/billing.declarations';

const app = createApplication({ modules: [kernelModule(), platformModule, contextModule('billing', billing)] });
```

### Le même mécanisme, dans un seul fichier

Dans un projet, ces classes vivent chacune dans leur fichier, et la ligne `injected(...)` est
écrite par `ddd-ts-kit docs` dans le fichier généré du contexte. Ramassé dans un seul fichier
qui compile, le mécanisme entier se lit d'un coup : des décorateurs qui disent ce qu'est chaque
classe, une ligne qui dit ce que prend un constructeur, et un module fait à partir des classes.

<!-- checked sample -->
```ts
import { Command, CommandBus, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler, Gateway, Public, injected } from '@ddd-ts-kit/kernel/declarations';
import { contextModule, createApplication, kernelModule } from '@ddd-ts-kit/di';

// application/ports/stock.port.ts : un port n'est jamais décoré.
export abstract class StockGateway {
  abstract reserve(sku: string): Promise<void>;
}

// application/commands/place-order/place-order.command.ts
@Public()
export class PlaceOrder extends Command<string> {
  constructor(readonly sku: string) {
    super();
  }
}

// application/commands/place-order/place-order.handler.ts : le décorateur ne liste rien.
@CommandHandler(PlaceOrder)
export class PlaceOrderHandler implements CommandHandler<PlaceOrder> {
  constructor(
    private readonly stock: StockGateway,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: PlaceOrder): Promise<string> {
    await this.stock.reserve(command.sku);

    return this.ids.next();
  }
}

// infrastructure/external/in-memory-stock.gateway.ts : lié à son port par son décorateur.
@Gateway(StockGateway)
export class InMemoryStockGateway implements StockGateway {
  readonly reserved: string[] = [];

  async reserve(sku: string): Promise<void> {
    this.reserved.push(sku);
  }
}

// ordering.declarations.ts, généré par `ddd-ts-kit docs` à partir du constructeur ci-dessus.
injected(PlaceOrderHandler, [StockGateway, IdGenerator]);

// main.ts
const ordering = contextModule('ordering', [PlaceOrder, PlaceOrderHandler, InMemoryStockGateway]);
const app = createApplication({ modules: [kernelModule(), ordering] });

const orderId: string = await app.resolve(CommandBus).execute(new PlaceOrder('sku-1'));
```

Comparez avec « Une première application » : les instructions `bind(...).toClass(...)` et
`command(...).handledBy(...)` ont disparu, chaque classe porte la sienne, et la liste du
gestionnaire a quitté la racine de composition pour une ligne générée que personne n'écrit à la
main.

## Ports et valeurs

### Un port est une classe abstraite

La classe nomme la dépendance et porte son type : un paramètre de constructeur typé par elle
nomme ce qui est injecté, `app.resolve(Clock)` renvoie un `Clock`, et rien d'autre ne tient lieu
de port. Les
ports du kernel (`Clock`, `IdGenerator`, `UnitOfWork`, `CommandBus`, `QueryBus`,
`IntegrationEventPublisher`, `ExecutionScope`...) sont des classes abstraites importées de
`@ddd-ts-kit/kernel` ; les vôtres s'écrivent de la même façon.

Au lieu de la paire habituelle de tsyringe, une interface pour le type et une constante pour le
jeton, tenues en phase à la main :

```ts
export interface PaymentGateway {
  capture(invoiceId: string): Promise<string>;
}
export const PAYMENT_GATEWAY = Symbol('PaymentGateway');

@injectable()
export class CaptureInvoiceHandler {
  constructor(@inject(PAYMENT_GATEWAY) private readonly payments: PaymentGateway) {}
}
```

écrivez une seule classe abstraite, qui est les deux à la fois :

<!-- checked sample -->
```ts
import { Clock } from '@ddd-ts-kit/kernel';

export abstract class PaymentGateway {
  abstract capture(invoiceId: string): Promise<string>;
}

export class CaptureInvoiceHandler {
  constructor(
    private readonly payments: PaymentGateway, // le type du paramètre nomme le port
    private readonly clock: Clock, // un port du kernel, écrit de la même façon
  ) {}
}
```

Pas de décorateur de paramètre, pas de `@injectable()`, pas de constante à importer à côté du
type : la classe qui type le paramètre est aussi le jeton que nomme sa liste (écrite dans une
instruction ou générée par `ddd-ts-kit docs`), si bien que rien d'autre n'est à tenir en
phase.

La règle, vérifiée quand une liaison est enregistrée (`INVALID_PORT` pour `toClass`, une
`DeclarationError` pour un décorateur) :

- un port n'a que des membres abstraits : pas de corps, pas de paramètre de constructeur, pas de
  membre privé ou protégé. Une exception, `static readonly tokenKey` (voir « Identité ») ;
- un port peut étendre un autre port, et c'est alors un autre port ;
- un adaptateur `implements` son port et ne l'`extends` jamais ;
- une classe liée à elle-même (`bind(Settings).toClass(Settings, [...])`, un gestionnaire, un
  *job*, une politique) n'est pas un port et garde ses méthodes.

Comme un port ne contient rien d'autre qu'une forme, un *fake* et un objet simple en tiennent
lieu : `fake(Clock, { now: () => new Date(0) })`.

### Une valeur est typée par une classe abstraite, elle aussi

Un objet de configuration, un accès à une base de données, une liste, une primitive : une classe
abstraite aux propriétés `abstract readonly`, liée par `toValue` à un objet simple. C'est la
seule manière.

```ts
// platform/database.ts
export abstract class Database {
  abstract readonly client: Knex;
}

// contexts/billing/application/ports/payment-settings.port.ts
export abstract class PaymentSettings {
  abstract readonly apiUrl: string;
  abstract readonly apiKey: string;
}

// platform/composition/platform.module.ts
builder.bind(Database).toValue({ client: knex(config.database) });
builder.bind(PaymentSettings).toValue({ apiUrl: config.payments.url, apiKey: config.payments.key });
```

Une primitive s'enveloppe : `abstract class TaxRate { abstract readonly value: number }`, puis
`builder.bind(TaxRate).toValue({ value: 0.2 })`.

Une valeur et un port ensemble, dans un module qui compile : l'adaptateur reçoit la valeur par
son constructeur comme toute autre dépendance, et `resolve` renvoie chacun, typé par sa classe.

<!-- checked sample -->
```ts
import { createApplication, defineContextModule, kernelModule } from '@ddd-ts-kit/di';

// Une valeur : une classe abstraite aux propriétés abstract readonly.
export abstract class PaymentSettings {
  abstract readonly apiUrl: string;
}

// Un port.
export abstract class PaymentGateway {
  abstract capture(invoiceId: string): Promise<string>;
}

// L'adaptateur reçoit la valeur par son constructeur, comme toute autre dépendance.
export class HttpPaymentGateway implements PaymentGateway {
  constructor(private readonly settings: PaymentSettings) {}

  async capture(invoiceId: string): Promise<string> {
    return `${this.settings.apiUrl}/captures/${invoiceId}`;
  }
}

const paymentsModule = defineContextModule({
  name: 'payments',
  register(builder) {
    builder.bind(PaymentSettings).toValue({ apiUrl: 'https://payments.example' });
    builder.bind(PaymentGateway).toClass(HttpPaymentGateway, [PaymentSettings]).as('gateway');
  },
});

const app = createApplication({ modules: [kernelModule(), paymentsModule] });

const gateway: PaymentGateway = app.resolve(PaymentGateway); // typé par le port, sans conversion de type
const settings: PaymentSettings = app.resolve(PaymentSettings);

console.log(await gateway.capture('inv-1'), settings.apiUrl);
```

### Ce que vérifie le compilateur

Là où la déclaration ou l'instruction est écrite, sans rien exécuter :

| Erreur | Exemple |
|---|---|
| la classe n'implémente pas le port | `bind(Mailer).toClass(SmsSender)`, `@Repository(InvoiceRepository)` sur une classe à laquelle manque `findById` |
| la valeur n'a pas la forme du port | `bind(Clock).toValue('noon')`, `fake(OrderRepository, { save })`, `override(Clock, 12)` |
| une liste nomme un port d'un autre type | `handledBy(GetOrderHandler, [Clock])` pour un constructeur qui prend un `OrderRepository` |
| une liste suit un autre ordre que le constructeur | `[IdGenerator, Clock]` pour `(clock: Clock, ids: IdGenerator)` |
| il manque un élément à une liste ou elle en a un de trop, ou une instruction d'un module explicite n'en a pas | `toClass(ReserveStock)` pour un constructeur qui a des paramètres |
| une liste nomme une classe concrète là où son port est attendu | `[InMemoryOrderRepository]` pour un paramètre typé `OrderRepository` |
| le gestionnaire ne traite pas ce message ou renvoie un autre résultat | `command(PlaceOrder).handledBy(CancelOrderHandler, ...)` |
| le gestionnaire d'événements traite une autre charge utile | `on(ParcelShipped, ...).handledBy(InvoiceOnOrderPlaced, ...)` |
| `.requires(...)` sur un message qui ne porte pas d'acteur | `query(GetCatalog).requires(permission)` |

Une liste est celle d'une instruction d'un module explicite (`toClass`, `handledBy`), d'un
`injected(Class, [..])` généré, ou d'un décorateur qui en écrit encore une. Un décorateur sans
liste accepte n'importe quel constructeur : la signature est alors l'instruction, et ce que le
fichier généré enregistre à partir d'elle est vérifié de la même façon (voir « Injection par le
constructeur »).

Deux limites d'un système de types structurel. Une classe concrète se distingue de son port par
ce qu'elle ajoute : une classe sans membre propre, privés compris, est le port pour le
compilateur. Et un constructeur dont tous les paramètres sont optionnels a quand même des
paramètres : une instruction d'un module explicite lui donne une liste.

### Identité

`tokenIdentity(port)` est le symbole par lequel un conteneur identifie un port ;
`describeToken(port)` est le nom de sa classe, que les messages d'erreur et `describe()`
affichent.

- Un port de votre projet est identifié par la classe elle-même. Deux classes du même nom sont
  deux ports, et une classe qui étend un port est un autre port.
- Un port qui déclare `static readonly tokenKey = '<package>.<Port>'` est identifié par cette
  clé, la même dans chaque copie de son *package* que charge un processus. Les ports du kernel
  en déclarent tous une (`kernel.Clock`...), tout comme `UseCaseGuard`, `UseCaseDeclarations` et
  `DeclaredPolicies` de ce *package* : un gestionnaire compilé contre une copie du kernel est
  câblé par un conteneur bâti sur une autre.
- La clé ne s'hérite pas : `abstract class BusinessClock extends Clock` est un autre port, lié à
  part.

La limite : un port à vous sans `tokenKey`, chargé deux fois (le même fichier importé comme
source et comme sortie compilée, ou un *package* installé en deux versions), fait deux ports. La
liaison faite pour l'un ne répond pas à l'autre, que l'application signale comme non lié.
Chargez chaque port une seule fois, ou donnez un `tokenKey` à un port qu'expose un *package*
publié.

## Ce qu'une classe peut déclarer

La liste complète, avec les options de chacune, est dans le README de `@ddd-ts-kit/kernel`
(« Déclarations »). Ce que ce *package* fait de chacune :

| Déclaration | Devient |
|---|---|
| `@Requires(permission, options?)` / `@Public()` sur une commande ou une requête | l'accès du cas d'usage : ce que disent `.requires(...)` et `.public()` dans un module explicite, lu par `authorization: 'required'` et par le module d'autorisation |
| `@CommandHandler(Message)`, `@QueryHandler(Message)` | un singleton de nature `use-case`, enregistré sur `CommandBus` ou `QueryBus` |
| `@IntegrationEventHandler(contract, { consumer })` | un singleton de nature `consumer`, abonné par `start()` sur l'abonné de son contexte, idempotent par nom de consommateur, exécuté dans le contexte d'exécution de l'événement, sa marque et son travail dans une seule unité de travail |
| `@DomainEventHandler(Event, { phase? })` | un singleton de nature `domain-event-handler`, rattaché à `DomainEventDispatcher` sous le `eventName` que déclare sa classe d'événement à la création de l'application, dans sa phase : `before-commit` (par défaut), à la fin de l'unité de travail et dans sa transaction, ou `after-commit`, une fois qu'elle a été validée ; un événement distribué sous ce nom et construit à partir d'une autre classe est laissé de côté |
| `@Projection(name)`, avec `@On(definition)` ou `@On(Event)` sur ses méthodes | un singleton de nature `consumer`. Chaque événement d'intégration qu'elle applique est abonné par `start()` sous le nom de la projection, exactement comme l'est un gestionnaire d'événements d'intégration : son propre contexte d'exécution, idempotent par nom, sa marque et son écriture dans une seule unité de travail. Chaque événement du domaine de son propre contexte est rattaché à `DomainEventDispatcher` et appliqué pendant l'enregistrement. Voir « Projections » |
| `@Scheduled(name, schedule and options)` | un singleton de nature `job`, enregistré sur `JobScheduler` à la création de l'application, démarré par `start()` après les consommateurs et arrêté en premier par `stop()` ; voir « Jobs planifiés » |
| `@Repository(Port, options?)` | la liaison du port, nature `repository` : son enregistrement remet les événements du domaine de l'agrégat à l'unité de travail, qui les distribue à sa fin |
| `@Gateway(Port, options?)` | la liaison du port, nature `gateway` |
| `@Adapter(Port, { kind? })` | la liaison du port, nature `external` (par défaut) ou `publisher` |
| `@Policy(permission, { name })` | un singleton listé dans `DeclaredPolicies`, que le module d'autorisation évalue |

Un gestionnaire, un *job*, une politique et un gestionnaire d'événements sont liés sous
eux-mêmes : la classe est ce qui les construit, et `app.resolve(IssueInvoiceHandler)` renvoie
l'instance que le bus exécute. Une classe fait donc une liaison : lister une classe déclarée
dans deux modules est refusé.

Les options d'un *repository*, d'une *gateway* et d'un adaptateur sont celles d'une liaison
explicite : `transient: true` pour `.transient()`, `aspects: [...]` pour `.with(...)`, le premier
le plus à l'extérieur, et `replaces: true` pour `rebind`, dont se sert un adaptateur de
plateforme pour prendre la place d'un défaut du module du kernel
(`@Adapter(UnitOfWork, { replaces: true })`). La nature
parvient au hook `decorate`, si bien que le traçage et les aspects globaux voient les
adaptateurs déclarés comme ils voient les explicites. Un gestionnaire est construit au premier
message qu'il traite ; rien n'est construit quand une classe est déclarée ni quand un module est
créé.

### `contextModule(name, declared)`

`declared` est une classe, une liste (les listes peuvent s'imbriquer) ou l'import d'espace de
noms d'un barrel. D'un espace de noms, seules les classes déclarées sont gardées, si bien que le
barrel peut aussi exporter des ports et des types. Une classe nommée directement dans une liste
doit porter une déclaration (`UNDECLARED_CLASS`) : un décorateur oublié n'est pas sauté en
silence. Une classe rencontrée deux fois est prise une seule fois. Le module est statique : un
bundler suit chaque classe, et une analyse du code mort aussi.

### `discoverContext(name, directory, options?)`

Depuis `@ddd-ts-kit/di/discovery`, la seule entrée de ce *package* qui lit le disque. Elle charge,
dans l'ordre de leurs chemins, chaque fichier sous `application/` et `infrastructure/` du
contexte dont le nom se termine par un suffixe de rôle, et garde les classes exportées qui se
déclarent ; puis `<name>.dependencies` du même répertoire quand il existe, le fichier généré qui
enregistre ce que prennent leurs constructeurs (voir « Injection par le constructeur ») :

| Suffixe | Dossier | Déclare |
|---|---|---|
| `*.command`, `*.query` | `application/commands/`, `application/queries/` | `@Requires` ou `@Public` |
| `*.handler` | `application/commands/`, `application/queries/` | `@CommandHandler` ou `@QueryHandler` |
| `*.integration-handler` | `application/integration/handlers/` | `@IntegrationEventHandler` |
| `*.publisher` | `application/integration/publishers/` | `@DomainEventHandler` |
| `*.event-handler` | `application/event-handlers/` | `@DomainEventHandler` |
| `*.policy` | `application/authorization/` | `@Policy` |
| `*.job` | `application/scheduling/` | `@Scheduled` |
| `*.projection` | `application/projections/` | `@Projection` |
| `*.repository` | `infrastructure/persistence/` | `@Repository` |
| `*.gateway`, `*.adapter` | `infrastructure/` | `@Gateway`, `@Adapter` |

Un *publisher* est un gestionnaire d'événements du domaine dont le travail est d'annoncer
l'événement aux autres contextes : la même déclaration qu'un gestionnaire d'événements, sous un
suffixe et un dossier qui disent à quoi il sert.

`domain/`, `presentation/`, `published-language/` et `test/` ne sont jamais lus, pas plus que
les fichiers `*.port` de `application/ports/` : les ports et les *fakes* sont laissés de côté.
Elle échoue avec une `WiringError` qui nomme le fichier :

- `DISCOVERY_FAILED` : un fichier qui lève une erreur au chargement (l'échec est gardé en
  `cause`), ou un répertoire qui n'a ni `application/` ni `infrastructure/` ;
- `NOTHING_DECLARED` : un fichier à suffixe de rôle qui n'exporte aucune classe déclarée ;
- `MISPLACED_DECLARATION` : un fichier à suffixe de rôle hors de son dossier (refusé avant d'être
  chargé), ou une classe qui déclare un autre rôle que celui de son fichier.

Options : `ignore: (file) => boolean` écarte des fichiers (une politique écrite avec
`definePolicy`, un adaptateur lié explicitement) ; `extensions` (par défaut `.js`, `.mjs`, `.ts`,
`.mts`, la première qui existe l'emporte, jamais `.d.ts`) dit ce qui est chargé ;
`load: (url) => Promise<module>` remplace `import()`.

Ce qu'elle coûte, à mettre en balance avec un barrel généré :

- elle lit des répertoires et importe au démarrage, séquentiellement, avant que l'application
  existe ;
- un bundler ne peut pas la suivre : une application empaquetée liste ses classes avec
  `contextModule` ;
- les fichiers qu'elle charge ne sont importés par rien, si bien qu'il faut dire à knip et à
  dependency-cruiser que ce sont des entrées (voir « Limites ») ;
- elle exécute ce qu'exécute le processus : du `.js` compilé en production, du `.ts` seulement
  sous un loader ou un exécuteur de tests qui les transforme ;
- sous Vitest, ce *package* doit être intégré (inline), pour que l'`import()` de la découverte
  passe par l'exécuteur, qui compile les fichiers de rôle `.ts` et abaisse leurs décorateurs :
  `test: { server: { deps: { inline: ['@ddd-ts-kit/di'] } } }`. Un projet initialisé avec
  `--assembly discovery` a cette ligne dans son `vitest.config.ts`.

Préférez `contextModule` avec un barrel pour tout ce qui est empaqueté, pour un démarrage à
froid serverless, et chaque fois que l'outillage doit voir les classes ; préférez la découverte
quand ajouter un fichier doit suffire.

## Injection par le constructeur

Une classe déclarée dit une seule fois ce dont elle dépend, dans son constructeur, et son
décorateur ne liste rien :

```ts
@CommandHandler(IssueInvoice)
export class IssueInvoiceHandler implements CommandHandler<IssueInvoice> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}
}
```

Le conteneur ne demande pas ces types au compilateur : `design:paramtypes` n'existe qu'avec les
décorateurs historiques (legacy) compilés par `tsc` ou swc, si bien qu'il est absent avec les
décorateurs standard et sous `tsx` ou esbuild, et qu'il vaut `Object` pour un port importé avec
`import type`. À la place, `ddd-ts-kit docs` (et chaque `generate`, et chaque démarrage du script
`dev`) lit les signatures des constructeurs dans les sources et écrit, dans le fichier généré du
contexte, ce que reçoit chaque classe :

```ts
// contexts/billing/billing.declarations.ts (généré)
import { injected } from '@ddd-ts-kit/kernel/declarations';
// ... un import par classe et par jeton

export * from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.handler';
// ... un export par fichier de rôle

injected(IssueInvoiceHandler, [InvoiceRepository, IdGenerator, Clock]);
```

`injected` enregistre la liste dans un registre du kernel, partagé par chaque copie du kernel
que charge un processus, et il est typé comme la liste d'une instruction : le compilateur refuse
une liste générée qui ne correspond pas au constructeur. Quand un module est enregistré, chaque
classe déclarée reçoit, dans cet ordre :

1. la liste de son décorateur, quand il en a écrit une (`@CommandHandler(IssueInvoice, [InvoiceRepository, IdGenerator, Clock])` :
   la forme qu'écrivaient les projets 0.1, toujours prise en charge, et elle l'emporte) ;
2. la liste qu'`injected` a enregistrée pour elle ;
3. rien, quand son constructeur ne prend aucun paramètre.

Tout autre cas arrête `createApplication` avant qu'une seule instance soit construite :

| Code | Quand | Le message dit |
|---|---|---|
| `MISSING_DEPENDENCIES` | le constructeur prend des paramètres, le décorateur ne liste rien et aucun fichier généré chargé n'a enregistré de liste | la classe, son fichier quand la découverte l'a chargée, le module, et qu'il faut lancer `ddd-ts-kit docs` et assembler le contexte à partir du fichier généré |
| `DEPENDENCY_ARITY` | la liste enregistrée a une autre longueur que le constructeur (le fichier est périmé), ou la liste d'un décorateur est plus courte que le constructeur (une conversion de type, du JavaScript pur) | les deux longueurs, les jetons de la liste, et la même commande |

Ainsi rien n'est jamais injecté à `undefined`. D'où viennent les listes, selon l'assemblage :

| | Les listes sont dans | Chargées par |
|---|---|---|
| `contextModule('billing', billing)` avec le barrel | `billing.declarations.ts`, après les exports | l'`import * as billing` de la racine de composition, ou d'un test |
| `discoverContext('billing', directory)` | `billing.dependencies.ts` (`.js` une fois compilé), à côté des couches du contexte | le parcours, avec les fichiers de rôle, sous l'extension préférée ; un contexte dont les classes ne prennent rien n'en a pas |
| un module explicite, `bind(..).toClass(C, [..])`, `handledBy(H, [..])` | l'instruction : l'explicite reste explicite, rien n'est lu dans une signature | le fichier du module |
| `builder.include(SomeDeclaredClass)` dans un module explicite | la liste de son décorateur, ou le fichier généré de son contexte quand ce fichier est importé | le fichier du module |

Un test assemble un contexte à partir de son fichier généré, comme le fait la racine de
composition. Pour construire une classe seule, prenez-la dans ce fichier :
`contextModule('billing', { IssueInvoiceHandler: billing.IssueInvoiceHandler })`. Une classe
importée depuis son propre fichier et passée seule n'a pas de liste, et elle est refusée par son
nom.

`declaredTokens(declared)` renvoie le jeton sous lequel chaque classe déclarée d'une source est
liée (son port pour un adaptateur, la classe elle-même pour un gestionnaire, un *job*, une
politique ou une projection) :
`declaredTokens(billing).map((token) => app.resolve(token))` construit chaque classe d'un
contexte, et c'est ainsi qu'un test prouve qu'aucune n'est laissée sans ce qu'elle prend.

Ce qui tient une liste générée à jour est hors de ce *package* : `declarations/barrel-current`
de `ddd-ts-kit check` et `ddd-ts-kit docs --check` échouent, en nommant la classe, quand un
constructeur a changé sans régénération, et `declarations/constructor-injection` refuse un
paramètre qui ne nomme pas une classe unique.

## Modes de décorateurs

Les déclarations fonctionnent sous les deux modes de décorateurs de TypeScript, avec la même
ligne de source :

| *Stack* | `tsconfig.json` | Pourquoi |
|---|---|---|
| class-validator, NestJS, entités TypeORM, toute bibliothèque à décorateurs historiques | `"experimentalDecorators": true` | ces bibliothèques n'ont que des décorateurs historiques, et un programme a un seul mode |
| tout le reste | rien : laissez `experimentalDecorators` non défini | les décorateurs standard (TC39) n'ont besoin d'aucune option |

Un décorateur de déclaration est une fonction de la seule classe. L'appel historique lui passe
la classe, l'appel standard lui passe la classe et un contexte qu'il ne lit pas, si bien que la
même fonction sert les deux et range la déclaration dans un registre du kernel, jamais dans
`Symbol.metadata`. Aucun des deux modes n'a besoin d'`emitDecoratorMetadata`, et aucun décorateur
de paramètre n'existe dans l'un ou l'autre : ce que prend un constructeur est lu dans le source
et enregistré par un fichier généré, le seul mécanisme dans les deux modes. Vitest abaisse
lui-même les décorateurs historiques ; pour les standard, ajoutez `decorators()` de
`@ddd-ts-kit/testing/vitest` à la configuration de Vitest.

## Un module explicite

L'alternative : chaque liaison écrite à la main dans `<context>.module.ts`. Il ne demande aucun
décorateur, et convient à un contexte au câblage inhabituel (fabriques, valeurs, liaisons
conditionnelles) ou à une équipe qui veut le câblage dans un seul fichier. Les ports sont les
mêmes classes abstraites, dans les mêmes fichiers.

```ts
// contexts/ordering/ordering.module.ts
import { Clock, CommandBus, IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { defineContextModule } from '@ddd-ts-kit/di';
import { PaymentCaptured } from '@/contexts/billing/published-language';

export const orderingModule = defineContextModule({
  name: 'ordering',
  register(builder) {
    builder.bind(OrderRepository).toClass(DrizzleOrderRepository, [Database]).as('repository');
    builder.bind(OrderReads).toClass(DrizzleOrderReads, [Database]).as('repository');
    builder.bind(StockGateway).toClass(HttpStockGateway, [StockSettings]).as('gateway');

    builder
      .command(PlaceOrder)
      .handledBy(PlaceOrderHandler, [OrderRepository, StockGateway, IntegrationEventPublisher, IdGenerator, Clock]);
    builder.command(MarkOrderPaid).handledBy(MarkOrderPaidHandler, [OrderRepository, Clock]);
    builder.query(GetOrder).handledBy(GetOrderHandler, [OrderReads]);

    builder
      .on(PaymentCaptured, { consumer: 'ordering.mark-order-paid' })
      .handledBy(MarkOrderPaidOnPaymentCaptured, [CommandBus]);
  },
});
```

Rien d'autre n'est nécessaire : pas d'enregistrement manuel sur un bus, pas de code
d'abonnement.

```ts
// main.ts
import { CommandBus } from '@ddd-ts-kit/kernel';
import { createApplication, kernelModule } from '@ddd-ts-kit/di';

const app = createApplication({ modules: [kernelModule(), platformModule, orderingModule, billingModule] });
await app.start();
const orderId = await app.resolve(CommandBus).execute(new PlaceOrder('sku-1')); // typé string
process.on('SIGTERM', () => void app.stop());
```

```ts
// contexts/ordering/test/unit/place-order.handler.spec.ts
import { createTestApplication, fake } from '@ddd-ts-kit/di';

it('places an order and announces it', async () => {
  const orders = new InMemoryOrderRepository();
  const app = createTestApplication({
    modules: [orderingModule],
    fakes: [fake(OrderRepository, orders), fake(StockGateway, new InMemoryStock({ 'sku-1': 3 }))],
  });

  const orderId = await app.commandBus.execute(new PlaceOrder('sku-1'));

  expect(orders.count()).toBe(1);
  expect(app.eventBus.published).toMatchObject([{ type: 'ordering.order.placed', payload: { orderId } }]);
});
```

## Mélanger les deux styles

- **Dans une même application** : modules déclarés et explicites sont listés ensemble ; chaque
  vérification ci-dessous s'applique à travers eux.
- **Dans un même module** : `builder.include(declared)` ajoute des classes déclarées à côté
  d'instructions explicites, pour la valeur ou la fabrique qu'un décorateur ne sait pas
  exprimer.

  ```ts
  export const billingModule = defineContextModule({
    name: 'billing',
    register(builder) {
      builder.include(billing);
      builder.bind(TaxRate).toValue({ value: config.taxRate });
    },
  });
  ```

- **Un message décoré dans un module explicite** : `builder.command(IssueInvoice).handledBy(...)`
  lit le `@Requires` ou le `@Public` du message ; `.requires(...)` et `.public()` écrits sur le
  builder l'emportent.
- **Remplacer un adaptateur déclaré** : un module ultérieur appelle `builder.rebind(Port)`, et un
  test passe `fake(Port, ...)`, exactement comme pour une liaison explicite.

## Instructions d'un module explicite

| Appel | Signification |
|---|---|
| `bind(Port).toClass(Class, [ports])` | `new Class(...)` avec les ports résolus dans l'ordre ; la liste est omise pour un constructeur sans paramètre. La classe implémente le port (`INVALID_PORT` quand le port a un corps ou que la classe l'étend) |
| `bind(Port).toFactory((resolve) => instance)` | tout ce qu'un constructeur ne sait pas exprimer |
| `bind(Port).toValue(value)` | un objet existant, un *fake*, ou l'objet simple que type une classe de valeur |
| `.singleton()` / `.transient()` | une instance par application (par défaut) ou une par résolution |
| `.as(kind)` | rôle de la liaison, passé au hook `decorate` : `repository`, `gateway`, `external`, `use-case`, `publisher`, `consumer`, `domain-event-handler`, `job`. Un port qui étend le `Repository` du kernel est de nature `repository` sans cela |
| `rebind(Port).to...` | remplace la liaison d'un module listé plus tôt, comme un défaut de `kernelModule()` |
| `command(Type).handledBy(Handler, [ports])` | lie le gestionnaire sous lui-même (singleton, nature `use-case`) et l'enregistre sur `CommandBus` |
| `query(Type).handledBy(Handler, [ports])` | la même chose sur `QueryBus` |
| `on(contract, { consumer }).handledBy(Handler, [ports])` | lie le gestionnaire d'événements d'intégration sous lui-même (nature `consumer`) et abonne son `handle(event)` sur l'abonné du module |
| `job(name, schedule and options).handledBy(Job, [ports])` | lie le *job* sous lui-même (singleton, nature `job`) et enregistre son `run(execution)` sur `JobScheduler` |
| `backgroundJob(name, options?).handledBy(Job, [ports])` | lie le *job* en arrière-plan sous lui-même (singleton, nature `job`) et l'enregistre sur `QueueWorker` ; `name` est le `jobName` statique de la classe (voir « Jobs en arrière-plan ») |
| `.handledByFactory((resolve) => handler)` | la forme fabrique des cinq lignes ci-dessus, liée sous une classe faite pour l'instruction, qui se lit `command(PlaceOrder) handler` dans une description |
| `include(declared)` | ajoute des classes qui se déclarent : ce que fait `contextModule` |
| `around(kinds, (resolve) => aspect)` | place un aspect autour de chaque liaison de ces natures, quel que soit le module qui la déclare (voir « Événements du domaine et unité de travail ») |

**Une classe fait une liaison.** `handledBy(Handler)` lie la classe sous elle-même, si bien que
la même classe de gestionnaire ne peut pas être donnée à deux instructions : la seconde est
refusée avec `DUPLICATE_BINDING`. Un gestionnaire par message est la règle que le kit suit
partout ; là où un objet sert vraiment deux instructions, donnez à chacune
`handledByFactory(() => shared)`.

Les gestionnaires sont enregistrés à la création de l'application, qui résout les deux bus ; un
gestionnaire lui-même est construit au premier message qu'il traite, puis réutilisé. Les
consommateurs sont abonnés par `start()` et désabonnés par `stop()`, puisqu'un abonnement est un
effet de bord.

## La vie d'une application

![Les trois phases d'une application : createApplication vérifie le graphe entier avant de construire le moindre gestionnaire, app.start appelle onStart de chaque module puis abonne les consommateurs et démarre les jobs, app.stop arrête d'abord les jobs, désabonne les consommateurs, appelle onStop dans l'ordre inverse et vide en dernier le rapporteur d'erreurs et le logger](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/di-lifecycle.fr.svg)

Quel que soit le style de ses modules, une application passe par les trois mêmes appels :

- **`createApplication(options)`** est synchrone : il exécute `register` de chaque module,
  vérifie le graphe (une erreur lève une `WiringError`, voir « Vérifications »), lie tout dans un
  conteneur enfant et rattache les gestionnaires aux bus, les *jobs* au planificateur et les
  *jobs* en arrière-plan au *worker* de la file. Il construit ce à quoi il rattache (un bus quand
  un gestionnaire y va, le distributeur quand un gestionnaire d'événements du domaine existe, le
  planificateur et le *worker* de la file quand un *job* existe) et rien d'autre : un
  gestionnaire ou un adaptateur est construit à sa première résolution.
- **`app.start()`** appelle `onStart` de chaque module dans l'ordre de la liste, puis abonne les
  consommateurs, puis démarre le planificateur et le *worker* de la file. Avec
  `jobs: { start: false }`, le planificateur reste arrêté, tout comme le *worker* d'une file
  partagée ; une file gardée en mémoire (`InMemoryJobStore`, le défaut) est quand même
  consommée, puisqu'aucun autre processus ne la voit. Un second `start()` n'appelle plus aucun
  `onStart` et n'abonne rien deux fois.
- **`app.stop()`** défait tout cela dans l'ordre inverse : les *jobs* d'abord, tant que tout ce
  qu'ils utilisent fonctionne encore, puis les consommateurs, puis `onStop` de chaque module
  démarré dans l'ordre inverse, puis l'`ErrorReporter` et le `Logger`. Un module dont le `onStop`
  échoue n'empêche pas les autres de s'arrêter ; les échecs sont levés ensemble à la fin, sous la
  forme d'une `AggregateError`.

Un module qui possède une ressource l'ouvre dans `onStart` et la ferme dans `onStop` :

<!-- checked sample -->
```ts
import { createApplication, defineContextModule, kernelModule } from '@ddd-ts-kit/di';

interface Pool {
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
}

declare function createPool(url: string): Pool;
declare const config: { readonly databaseUrl: string };

export abstract class Database {
  abstract readonly pool: Pool;
}

export const platformModule = defineContextModule({
  name: 'platform',
  register(builder) {
    builder.bind(Database).toValue({ pool: createPool(config.databaseUrl) });
  },
  // Appelé par app.start(), dans l'ordre des modules, avant qu'aucun consommateur soit abonné.
  async onStart({ resolve }) {
    await resolve(Database).pool.query('select 1');
  },
  // Appelé par app.stop(), dans l'ordre inverse, une fois les jobs et les consommateurs arrêtés.
  async onStop({ resolve }) {
    await resolve(Database).pool.end();
  },
});

const app = createApplication({ modules: [kernelModule(), platformModule] });

await app.start();
process.once('SIGTERM', () => void app.stop());
```

## Gestionnaires d'événements d'intégration

`contract` est tout ce qui a `type`, `version` et `parse(event)` : une déclaration faite par
`defineIntegrationEvent` de `@ddd-ts-kit/events` convient telle quelle. Un événement d'une autre
version est sauté, un événement que le contrat ne sait pas lire lève `UnreadableEventError` pour
que le fournisseur le retente ou l'envoie en file de rejet (dead letter), et un événement livré
de nouveau est traité une seule fois par nom de `consumer` quand `ProcessedEventStore` est lié.
Le nom est obligatoire : c'est la clé d'idempotence, et il doit survivre au renommage d'une
classe.

![Ce qui arrive à un événement d'intégration livré à un consommateur : le contrat l'analyse et saute un autre type ou une autre version, ou refuse un événement illisible ; un événement valide est traité dans la portée d'exécution de l'événement et dans une seule unité de travail, où le magasin des événements traités saute une nouvelle livraison, et la marque et les écritures du gestionnaire sont validées ou annulées ensemble](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/di-consumer-event.fr.svg)

### Le contexte d'exécution de l'événement

Chaque consommateur traite ses événements dans `ExecutionScope`, dans un contexte qui lui est
propre : origine `event`, la corrélation de l'événement (son identifiant quand il n'en nomme
aucune), l'événement comme `causationId`, et `systemActor(consumer)` comme acteur, qui est donc
ce que `ActorContext` renvoie aux *repositories* du contexte consommateur. Rien à câbler. Un projet
dont les enveloppes nomment un acteur ajoute `on(contract, { consumer, actorOf: (event) => actor })`.
Pour que la corrélation commence à la requête, publiez par un *publisher* à portée :

```ts
kernelModule({
  eventPublisher: (resolve) => scopedPublisher(new OutboxPublisher(store), resolve(ExecutionScope)),
});
```

### Une unité de travail par événement

Quand `UnitOfWork` et `ProcessedEventStore` sont tous deux liés, ce que fait `kernelModule()`,
la marque d'idempotence et le travail du gestionnaire s'exécutent dans un seul
`unitOfWork.run`, ouvert dans le contexte d'exécution de l'événement :

- un gestionnaire qui échoue ne laisse aucune marque : la transaction qui la contenait est
  annulée (rollback), et la nouvelle livraison est traitée ;
- un gestionnaire qui réussit valide sa marque avec ses écritures : la nouvelle livraison est
  sautée, et il n'existe aucune fenêtre où l'une est gardée sans l'autre ;
- une commande qu'envoie le gestionnaire exécute son propre `unitOfWork.run` dans celui-ci, si
  bien que l'adaptateur de `UnitOfWork` doit rejoindre la transaction ouverte, comme le font les
  adaptateurs du kit ;
- l'unité de travail est résolue à chaque événement, comme le bus de commandes la résout à
  chaque commande.

Cela vaut pour un magasin dont la marque est écrite dans la base de données de l'unité de
travail. Sans `UnitOfWork` lié, la marque est prise d'abord et rendue avec `release` quand le
gestionnaire échoue, pour un magasin qui en a un ; un magasin sans `release` garde la marque d'un
gestionnaire qui a échoué.

### L'abonné de chaque contexte

Un gestionnaire d'un contexte est abonné sur `EventSubscribers.forContext(<module name>)`. Par
défaut, chaque contexte reçoit l'unique `IntegrationEventSubscriber`, qui est le bus
d'événements en mémoire : un processus, un bus, rien à dire.

Un *broker* donne à chaque contexte consommateur son propre abonné, pour que le contexte garde
ses files d'attente quand il est extrait. Dites-le une fois, dans le module du kernel ou depuis
un module ultérieur :

```ts
kernelModule({ eventBus: bus, eventSubscribers: { forContext: (name) => bus.forConsumer(name) } });

builder.rebind(EventSubscribers).toValue({ forContext: (name) => bus.forConsumer(name) });
```

Le nom passé à `forContext` est le nom du module : le premier argument de `contextModule` et de
`discoverContext`, le `name` de `defineContextModule`. Une application sans le module du kernel
a besoin que l'un des deux soit lié, `IntegrationEventSubscriber` ou `EventSubscribers` ;
`EventSubscribers` l'emporte quand les deux le sont.

## Projections

Une projection est une classe de `application/projections/`, dans un fichier `*.projection.ts`,
déclarée avec `@Projection('<context>.<name>')` ; le README de `@ddd-ts-kit/kernel`
(« Projections ») dit ce qu'elle peut faire et pourquoi ses écritures sont idempotentes et
ordonnées. Ici, elle est câblée : `contextModule` et `discoverContext` la trouvent comme toute
classe déclarée, et un module explicite la prend avec
`builder.include(AppointmentListProjection)`.

La CLI connaît ce rôle : `application/projections/` est un répertoire de l'arborescence
canonique, `ddd-ts-kit generate projection <context> <Name> <event-type>` en écrit une avec sa
*spec*, le barrel généré l'exporte et enregistre ce que prend son constructeur, et `describe` et
la référence de `CONTEXT.md` la listent avec les événements qu'elle applique.

```ts
const app = createTestApplication({ modules: [contextModule('reporting', reporting)] });

await app.start();
await app.eventBus.publish([orderPlaced('evt-1'), orderPlaced('evt-1'), orderPlaced('evt-2')]);

expect(await app.get(CustomerOrders).get('customer-1')).toMatchObject({ orders: 2 });
```

Une *spec* alimente une projection par le bus en mémoire et lit le modèle par son port : il n'y a
rien d'autre à apprendre. Le *fake* d'un port de modèle de lecture est `InMemoryReadModelStore`
du kernel, lié par son adaptateur ou donné avec `fake(Port, store)`.

- **Un seul consommateur.** Le nom de la projection est le nom de consommateur de chaque
  événement qu'elle applique : la portée d'idempotence dans `ProcessedEventStore`, l'acteur
  système sous lequel elle s'exécute, le *span* `process <projection>` et, derrière un *broker*,
  sa file d'attente ou son groupe. Deux projections du même nom sont refusées
  (`DUPLICATE_PROJECTION`), tout comme deux méthodes d'une même projection qui appliquent le même
  événement (`DUPLICATE_CONSUMER`).
- **Une unité de travail par événement.** Avec `UnitOfWork` et `ProcessedEventStore` liés à la
  même base de données que le modèle de lecture, la marque et la ligne sont validées ou annulées
  ensemble. Sans eux, l'estampille que porte chaque ligne rend quand même une nouvelle livraison
  sans effet.
- **Mesurée.** Avec `Metrics` lié, `projection_events_total` compte chaque événement par
  `context`, `projection`, `event` et `result` (`applied`, `stale`, `ignored`, `failed`), et
  `projection_last_event_age_ms` contient l'âge du dernier événement appliqué au moment où il l'a
  été.
- **Décrite.** `describe().projections` liste chaque projection avec les événements qu'elle
  applique et la méthode de chacun ; elles n'apparaissent pas parmi `integrationEventHandlers` et
  `domainEventHandlers`.

## Derrière un broker

La découverte, un *broker* et une base de données, sans aucun utilitaire à vous. La racine de
composition complète :

```ts
// main.ts
import { EventSubscribers, ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { createApplication, defineContextModule, kernelModule } from '@ddd-ts-kit/di';
import { discoverContext } from '@ddd-ts-kit/di/discovery';
import { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';

const bus = new RabbitMqEventBus({ connection: config.amqpUrl });

const platformModule = defineContextModule({
  name: 'platform',
  register(builder) {
    builder.bind(Database).toValue({ client: knex(config.database) });
    builder.rebind(UnitOfWork).toClass(DatabaseUnitOfWork, [Database]);
    builder.rebind(ProcessedEventStore).toClass(DatabaseProcessedEvents, [Database]);
    builder.rebind(EventSubscribers).toValue({ forContext: (name) => bus.forConsumer(name) });
  },
  onStop: () => bus.close(),
});

const app = createApplication({
  modules: [
    kernelModule({ eventBus: bus }),
    platformModule,
    await discoverContext('ordering', new URL('./contexts/ordering/', import.meta.url)),
    await discoverContext('billing', new URL('./contexts/billing/', import.meta.url)),
  ],
  authorization: 'required',
});

await app.start();
process.on('SIGTERM', () => void app.stop());
```

C'est tout : `discoverContext('billing', ...)` nomme le module `billing`, si bien que ses
gestionnaires d'événements d'intégration sont abonnés sur `bus.forConsumer('billing')`, chaque
événement traité dans le contexte d'exécution de l'événement, sa marque et son travail dans une
seule transaction de la base de données. Avec un barrel à la place de la découverte, les deux
lignes deviennent `contextModule('ordering', ordering)` et `contextModule('billing', billing)`,
et rien d'autre ne change. `DatabaseUnitOfWork` et `DatabaseProcessedEvents` tiennent lieu des
adaptateurs de votre *package* de persistance ; tout bus doté d'un `forConsumer(name)` convient
là où se trouve `RabbitMqEventBus`.

## Le module du kernel

`kernelModule(options?)` lie les ports dont dépend chaque contexte.

| Port | Par défaut | Option |
|---|---|---|
| `Clock` | `SystemClock` | `clock` |
| `IdGenerator` | `UuidGenerator` | `ids` |
| `UnitOfWork` | `InMemoryUnitOfWork` | `unitOfWork` |
| `CommandBus` | `InMemoryCommandBus`, qui exécute chaque commande dans l'unité de travail : les événements du domaine qu'annoncent ses enregistrements sont distribués une fois que le gestionnaire a rendu la main, avant la validation, puis les gestionnaires `after-commit` s'exécutent | `commandBus` |
| `QueryBus` | `InMemoryQueryBus` | `queryBus` |
| `EventBus` | `InMemoryEventBus`, qui rejette avec une `AggregateError` de ce qu'ont levé ses gestionnaires ; `eventBusFailures: 'as-thrown'` relance l'échec d'un seul gestionnaire tel quel (la valeur par défaut d'une prochaine version mineure) | `eventBus`, `eventBusFailures` |
| `IntegrationEventPublisher` | le bus d'événements | `eventPublisher` |
| `IntegrationEventSubscriber` | le bus d'événements | `eventSubscriber` |
| `EventSubscribers` | l'unique `IntegrationEventSubscriber`, pour chaque contexte | `eventSubscribers` |
| `ProcessedEventStore` | `InMemoryProcessedEventStore` | `processedEvents` |
| `ExecutionScope` | `AsyncLocalStorageExecutionScope` | `executionScope` |
| `ActorContext` | `ScopedActorContext` : l'acteur de la portée d'exécution | `actorContext` |
| `DomainEventDispatcher` | `InMemoryDomainEventDispatcher`, qui entend ce qu'a annoncé l'enregistrement de chaque *repository* ; un échec d'un gestionnaire `after-commit` va au `Logger` et à l'`ErrorReporter` (`reportAfterCommitFailures`) | `domainEvents` |
| `Logger` | `NoopLogger`. `app.stop()` le vide en dernier, après le rapporteur d'erreurs, et s'arrête quand même si le vidage échoue | `logger` |
| `Metrics` | `NoopMetrics` | `metrics` |
| `ErrorReporter` | `NoopErrorReporter`. Les bus par défaut et le planificateur par défaut lui remettent leurs échecs inattendus (jamais une `DomainError`), et `app.stop()` lui donne deux secondes pour se vider | `errorReporter` |
| `Cache` | `InMemoryCache` sur `Clock` | `cache` |
| `CacheInvalidation` | `PublishedCacheInvalidation` : des demandes de purge publiées sur `IntegrationEventPublisher` (l'outbox, quand il y en a une) ; une application multitenant passe la sienne avec `perTenant: true` | `cacheInvalidation` |
| `Lock` | `InMemoryLock` sur `Clock` : ce processus seulement | `lock` |
| `RateLimiter` | `InMemoryRateLimiter` sur `Clock` : ce processus seulement | `rateLimiter` |
| `JobScheduler` | `InProcessJobScheduler` de `@ddd-ts-kit/scheduling` sur `Clock`, `Lock`, `ExecutionScope`, `IdGenerator`, `Logger`, `Metrics` et `ErrorReporter` | `jobScheduler` |
| `TenantDirectory` | aucune : un *job* déclaré `tenancy: 'per-tenant'` est refusé quand il est enregistré. Fourni, le planificateur par défaut exécute un tel *job* une fois par *tenant* qu'il liste, dans la portée de ce *tenant* ; l'application de test prend `tenants` (par défaut le *tenant* de son contexte d'exécution) | `tenants` |

Les ports sont les classes abstraites de `@ddd-ts-kit/kernel` : un gestionnaire type un
paramètre de constructeur par `Clock` sans importer ce *package*.

Une option est une instance ou une fabrique `(resolve) => instance`. Un adaptateur qui a ses
propres dépendances se lit mieux dans le module qui les possède :

```ts
export const persistenceModule = defineContextModule({
  name: 'persistence',
  register(builder) {
    builder.bind(Database).toFactory(() => ({ client: connect(config.databaseUrl) }));
    builder.rebind(UnitOfWork).toClass(DrizzleUnitOfWork, [Database]);
    builder.rebind(IntegrationEventPublisher).toClass(OutboxPublisher, [OutboxStore]).as('publisher');
  },
});
```

Les cas d'usage publient par `IntegrationEventPublisher` et jamais par `EventBus`, si bien que
passer à une outbox ne touche aucun contexte. Un bus donné pour `CommandBus` ou `QueryBus` a
besoin d'une méthode `register(type, handler)` pour que les gestionnaires déclarés lui soient
rattachés.

## Jobs planifiés

Une classe de `application/scheduling/` qui porte `@Scheduled` est un *job* de son contexte :
rien d'autre ne l'enregistre.

```ts
// contexts/billing/application/scheduling/send-reminders.job.ts
import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { Scheduled, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel/declarations';

@Scheduled('billing.send-reminders', { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' })
export class SendRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    await this.commands.execute(new SendReminders(systemActor('billing.send-reminders'), execution.scheduledAt));
  }
}
```

- **Enregistré à la création de l'application**, sur `JobScheduler`, avec les valeurs par défaut
  de ses options remplies. La classe est construite à sa première exécution, si bien qu'un *job*
  qui ne peut pas être construit fait échouer cette exécution et rien d'autre.
- **Démarré par `start()`**, après les modules et une fois les consommateurs abonnés : un *job*
  envoie des commandes dont les événements doivent trouver leurs gestionnaires. **Arrêté en
  premier par `stop()`**, qui attend les exécutions en cours, puis les interrompt, tant que tout
  ce qu'elles utilisent fonctionne encore.
- **Chaque exécution a lieu dans `ExecutionScope`**, dans un contexte d'origine `schedule`, en
  tant que `systemActor('<job name>')`, avec une corrélation qui lui est propre. C'est le
  planificateur qui le fait, pas le *job*.
- **Le planificateur par défaut** est celui, interne au processus, de `@ddd-ts-kit/scheduling`,
  sur le `Clock` et le `Lock` liés. Avec le verrou par défaut, qui n'exclut qu'au sein d'un seul
  processus, plusieurs instances exécutent chacune chaque *job* : liez un verrou entre processus
  (`RedisLock`) avant de multiplier les instances. Ce que garantit une instance parmi plusieurs,
  et ce qu'elle ne garantit pas, est dans ce README.
- **Une application sans *job*** ne résout jamais le planificateur.

`createApplication({ jobs })` dit si ce processus exécute les *jobs* et ce que la configuration
change de chacun :

```ts
createApplication({
  modules,
  jobs: {
    start: config.runJobs,                                           // true par défaut
    settings: {
      'billing.send-reminders': { enabled: config.reminders.enabled },
      'billing.export-ledger': { schedule: { every: '6h' }, timeoutMs: 300_000 },
    },
  },
});
```

| Option | |
|---|---|
| `start: false` | les *jobs* sont enregistrés et décrits, `runNow` en exécute un, et `start()` ne démarre jamais le planificateur, ni le *worker* d'une file partagée (une file dans la mémoire du processus est quand même consommée) : le processus qui sert les requêtes à côté d'un processus *worker* qui exécute les *jobs* |
| `settings['<job name>']` | `enabled`, `schedule` et toute option de la déclaration (`overlap`, `missed`, `timeoutMs`, `jitterMs`, `singleInstance`), qui l'emportent sur ce que la classe a écrit. Une clé laissée non définie ne change rien |

`app.resolve(JobScheduler)` est le port : `runNow(name)` pour un point d'accès (endpoint)
d'exploitation, `describe()` pour la prochaine exécution et le dernier résultat de chaque *job*.
Un contexte extrait comme service à part emporte ses *jobs* avec lui : ils appartiennent à son
module, et rien n'est global.

## Jobs en arrière-plan

Une classe de `application/background/` qui porte `@Background` est un *job* en arrière-plan de
son contexte, nommé par son `jobName` statique :

```ts
// contexts/billing/application/background/compile-statements.background-job.ts
@Background({ maxAttempts: 3, timeout: '10m' })
export class CompileStatementsBackgroundJob implements BackgroundJob<CompileStatementsPayload> {
  static readonly jobName = 'billing.compile-statements';

  constructor(private readonly commands: CommandBus) {}

  async run(payload: CompileStatementsPayload, execution: BackgroundJobExecution): Promise<void> {
    await this.commands.execute(new CompileStatements(execution.jobId, payload.month));
  }
}
```

Un module explicite écrit `builder.backgroundJob('billing.compile-statements', { maxAttempts: 3 })
.handledBy(CompileStatementsBackgroundJob, [CommandBus])` ; un nom autre que le `jobName` de la
classe est refusé (`INVALID_JOB_SETTINGS`), un nom déclaré deux fois aussi (`DUPLICATE_JOB`).

- **Enregistré à la création de l'application** sur le `QueueWorker` de `@ddd-ts-kit/scheduling`,
  qui consomme ensuite la file d'attente du contexte. La classe est construite à sa première
  tentative.
- **Consommé tant que le processus exécute les *jobs*** : `start()` démarre le *worker* après le
  planificateur quand `jobs.start` ne vaut pas `false`, `stop()` l'arrête avec le planificateur,
  en attendant les tentatives en cours, puis en les interrompant. Un processus démarré avec
  `jobs: { start: false }` met en file et laisse la file partagée au *worker* ; une file gardée
  dans sa propre mémoire (`InMemoryJobStore`, le défaut) est quand même consommée, puisqu'aucun
  autre processus ne la voit.
- **`kernelModule()`** lie `JobStore` (en mémoire par défaut : liez `KnexJobStore`,
  `DrizzleJobStore`, `PrismaJobStore`, `TypeOrmJobStore` ou `RedisJobStore` avec `jobStore`, sinon aucun *job* n'atteint un *worker*
  d'un autre processus), `JobQueue` (une `StoredJobQueue` dessus, qui stocke le `traceparent`
  fourni par l'instrumentation) et `QueueWorker` (réglé par
  `queues: { concurrency, pollIntervalMs, graceMs }`, ses échecs remis à l'`ErrorReporter`).
- **`describe().backgroundJobs`** liste chaque *job*, sa file et ses options, valeurs par défaut
  remplies.

`kernelModule()` lie aussi `ProcessStore` (en mémoire par défaut : liez `KnexProcessStore`,
`DrizzleProcessStore`, `PrismaProcessStore` ou `TypeOrmProcessStore` avec `processStore`) et `ProcessRunner`, l'exécuteur de
`@ddd-ts-kit/scheduling` sur celui-ci, la `JobQueue`, le `CommandBus` et la `UnitOfWork` : les
gestionnaires qui pilotent un gestionnaire de processus dépendent de `ProcessRunner`, et son
*job* d'expiration est un *job* en arrière-plan du contexte. Dans une application de test,
`app.processes.list()` montre les instances.

Dans une application de test, `app.jobQueue` est la file sur laquelle les cas d'usage mettent
en file, en mémoire, et `app.backgroundJobs.runDue()` exécute ce qui est dû sur `app.clock` et
lève ce qu'une tentative a levé ; `app.backgroundJobs.store.list()` montre ce qui a été mis en
file. Ce que les *jobs* garantissent :
[Jobs en arrière-plan](../../docs/concepts/background-jobs.fr.md).

## Tests

Un contexte déclaré se teste comme un contexte explicite : le module est l'unité, les *fakes*
remplacent ses adaptateurs.

```ts
const app = createTestApplication({
  modules: [contextModule('billing', billing)],
  fakes: [fake(PaymentGateway, new InMemoryPayments())],
});
```

`fake(Port, value)` est vérifié : la valeur implémente le port. Une classe en mémoire, un
littéral d'objet et une classe écrite dans la *spec* conviennent tous, puisqu'un port est une
forme.

`createTestApplication({ modules, fakes, now?, idPrefix?, actor?, session?, executionContext?, authorization?, jobs?, eventBusFailures? })` place les modules sur un kernel
déterministe, qu'ils listent `kernelModule()` ou non, et renvoie l'application plus ce que
touche une *spec* :

| Membre | Est |
|---|---|
| `commandBus`, `queryBus` | les bus en mémoire, avec chaque gestionnaire déclaré |
| `eventBus` | `InMemoryEventBus` ; `eventBus.published` liste ce qu'ont annoncé les cas d'usage. Chaque contexte l'écoute, quels que soient les `EventSubscribers` que lient les modules. Avec `eventBusFailures: 'as-thrown'`, `publish` rejette avec l'échec d'un seul gestionnaire tel quel au lieu d'une `AggregateError` |
| `domainEvents` | `InMemoryDomainEventDispatcher` : l'enregistrement de chaque *repository*, adaptateur ou *fake*, lui annonce ses événements, avec le calendrier de l'application (à la fin de la commande, puis après elle pour les gestionnaires `after-commit`) ; une *spec* peut distribuer elle-même un événement du domaine pour voir réagir les gestionnaires déclarés, et `domainEvents.afterCommitFailures` contient ce qu'ont levé les gestionnaires `after-commit` |
| `clock` | `FixedClock` à `now` (par défaut `2026-01-01T00:00:00.000Z`) ; `clock.advance(ms)` |
| `ids` | `SequentialIdGenerator` : `id-1`, `id-2`... |
| `actorContext` | `FixedActorContext` ; `actAs(actor)` change l'acteur que voit l'infrastructure |
| `executionScope` | `FixedExecutionScope` (corrélation `test-correlation`, origine `test`), qui suit `actorContext` |
| `logger`, `metrics` | `InMemoryLogger` et `InMemoryMetrics` : vérifiez `logger.entries`, `metrics.samples` |
| `errors` | `InMemoryErrorReporter` : `errors.reports` liste les échecs inattendus des commandes, des requêtes et des *jobs*, sous forme de données |
| `cache` | `InMemoryCache` sur `clock` |
| `cacheInvalidation` | `InMemoryCacheInvalidation` : `cacheInvalidation.invalidated` liste les étiquettes que les cas d'usage ont demandé de purger |
| `lock`, `rateLimiter` | `InMemoryLock` et `InMemoryRateLimiter` sur `clock` |
| `jobs` | `runNow(name)` exécute un *job* déclaré comme le ferait le planificateur et lève ce qu'il a levé ; `scheduler` est un `ManualJobScheduler` sur `clock`, non démarré |
| `jobQueue`, `backgroundJobs` | la file sur laquelle les cas d'usage mettent en file, en mémoire, et ce qui l'exécute : `backgroundJobs.runDue()` (voir « Jobs en arrière-plan ») |
| `processes` | `InMemoryProcessStore` : `processes.list()` montre les instances des gestionnaires de processus |
| `get(Port)` | `resolve`, typé par le port |
| `as(actorOrSession, work)` | exécute un bloc en tant que quelqu'un d'autre, puis revient |

`actor`, `session` et `executionContext` disent ce que voit l'infrastructure par défaut : un acteur,
une session entière (son acteur devient l'acteur courant), ou le contexte d'exécution complet
pour une *spec* qui porte sur un *tenant*, une corrélation ou une échéance. `app.as` bascule le
temps d'un bloc et lui passe l'acteur, ce qu'une *spec* sur l'autorisation veut lire :

```ts
const app = createTestApplication({ modules: [billingModule, authorization], actor: accountant });

await app.as(accountant, (actor) => app.commandBus.execute(new IssueInvoice(actor, 'customer-1')));
await expect(
  app.as(clerk, (actor) => app.commandBus.execute(new VoidInvoice(actor, 'inv-1'))),
).rejects.toMatchObject({ code: 'FORBIDDEN' });

app.as(aSession().of(accountant).impersonatedBy('support-7').build(), () => {
  // l'infrastructure voit la session : l'audit consigne l'emprunt d'identité
});
```

Les cas d'usage reçoivent toujours l'acteur dans la commande ou la requête ; `as` décide
seulement de ce que voient les *repositories*, les colonnes d'audit et le cloisonnement par
*tenant* pendant que le bloc s'exécute.

**Les *jobs* ne sont jamais démarrés par le temps** dans une application de test : `start()`
abonne les consommateurs et laisse le planificateur tranquille, quoi que fasse l'horloge. Une
*spec* exécute un *job* par son nom et vérifie les *fakes*, comme elle le ferait pour une
commande :

```ts
await app.jobs.runNow('billing.send-reminders');

expect(mailer.sent).toHaveLength(2);
```

Pour une *spec* sur la planification elle-même, `await app.jobs.scheduler.start()` puis
`await app.jobs.scheduler.advance(ms)` font avancer `app.clock` et exécutent ce qui devient dû,
et `app.jobs.scheduler.runs` liste ce qui s'est passé. L'option `jobs` prend des réglages par
*job*, comme le fait `createApplication({ jobs: { settings } })`. Les exécutions tirent leurs
identifiants de corrélation d'un générateur qui leur est propre (`job-run-1`...), si bien qu'un
*job* ne touche pas aux identifiants que prévoit une *spec*.

Un *fake* doit tenir lieu d'un port qu'un module lie ou dont une classe dépend, sinon
`UNKNOWN_FAKE` est levé : un *fake* pour le mauvais port laisserait en silence le vrai
adaptateur en place. Les consommateurs reçoivent les événements une fois qu'`await app.start()`
s'est exécuté.

`createApplication({ overrides: [override(Port, value)] })` est la même paire sans cette
vérification, et `overrideForTests(app, Port, value)` remplace une liaison sur une application
existante ; appelez-le avant le premier `resolve`, puisqu'un singleton déjà construit garde ce
qu'il a reçu. Une substitution remplace la liaison, peut tenir lieu d'un module qui n'est pas
chargé, et n'est pas décorée. Chaque application possède un conteneur enfant tsyringe
(`app.container`), si bien que deux tests ne partagent jamais d'instances.

## Vérifications

`createApplication` lève une `WiringError` (avec un `code`) avant que quoi que ce soit soit
instancié :

- `DUPLICATE_BINDING` : un port lié deux fois, ou une classe donnée à deux instructions ou
  listée dans deux modules, les deux modules nommés ;
- `NOTHING_TO_REBIND` : un `rebind` d'un port qu'aucun module antérieur ne lie ;
- `INVALID_PORT` : une classe liée à un port qui porte un corps, ou qu'elle étend ;
- `UNBOUND_DEPENDENCY` : une dépendance de classe qu'aucun module ne lie, ou des gestionnaires,
  des consommateurs et des *jobs* déclarés sans le bus, l'abonné ou le planificateur sur lequel
  ils vont ;
- `DEPENDENCY_CYCLE` : un cycle entre des liaisons de classes, le chemin affiché ;
- `INCOMPLETE_BINDING` : un `bind`, `command`, `query`, `on` ou `job` laissé sans sa cible ;
- `DUPLICATE_HANDLER` : une commande ou une requête qui a deux gestionnaires, les deux modules
  nommés ;
- `DUPLICATE_CONSUMER` : deux consommateurs du même événement qui partagent un nom ;
- `DUPLICATE_PROJECTION` : deux projections qui partagent un nom ;
- `BUS_WITHOUT_REGISTER` : des gestionnaires déclarés pour un bus qui ne peut pas les recevoir ;
- `UNKNOWN_FAKE` : voir plus haut ;
- `UNDECLARED_CLASS` : une classe listée dans `contextModule` ou `include` sans déclaration ;
- `MISSING_DEPENDENCIES` : une classe déclarée dont le constructeur prend des paramètres et
  qu'aucune liste ne couvre : son décorateur n'en nomme aucune et aucun fichier généré chargé
  n'en a enregistré ;
- `DEPENDENCY_ARITY` : une liste d'une autre longueur que le constructeur auquel elle est
  destinée ;
- `DUPLICATE_JOB` : deux *jobs* qui partagent un nom, les deux modules nommés : le nom est le
  verrou, l'acteur et le libellé d'un *job* ;
- `UNKNOWN_JOB` : des réglages donnés pour un *job* qu'aucun module ne déclare ;
- `INVALID_JOB_SETTINGS` : une planification ou une option des réglages qui ne peut pas être lue
  (un cron, un fuseau horaire, un intervalle nul), ou un *job* d'un module explicite dont le nom
  ou la planification ne peut pas l'être.

`DUPLICATE_HANDLER`, `DUPLICATE_CONSUMER` et `DUPLICATE_JOB` sont signalés avant le
`DUPLICATE_BINDING` de la classe qu'ils partagent, pour que le message dise quelle est l'erreur.

Les vérifications ne distinguent pas les deux styles. Pour une classe déclarée, le message nomme
la classe et, quand la découverte l'a chargée, le fichier :

```
Token "InvoiceRepository" is bound twice: by module "billing" (declared by class
KnexInvoiceRepository in /app/dist/contexts/billing/infrastructure/persistence/knex-invoice.repository.js)
and by module "invoicing" (declared by class InMemoryInvoiceRepository).
```

Les fabriques ne déclarent pas ce qu'elles résolvent, si bien qu'un cycle ou un port manquant
qui passe par une fabrique est signalé à sa résolution (`DEPENDENCY_CYCLE`, `UNBOUND_TOKEN`).

## Diagnostic

`app.describe()` renvoie le câblage sous forme de données simples et sérialisables : les ports et
les classes par leur nom.

```ts
{
  modules: ['kernel', 'ordering'],
  bindings: [{ token: 'PlaceOrderHandler', module: 'ordering', kind: 'use-case', lifetime: 'singleton',
               source: 'class', implementation: 'PlaceOrderHandler',
               dependencies: ['OrderRepository', 'Clock'], overridden: false }],
  commands: [{ message: 'PlaceOrder', handler: 'PlaceOrderHandler', module: 'ordering' }],
  queries: [{ message: 'GetOrder', handler: 'GetOrderHandler', module: 'ordering' }],
  integrationEventHandlers: [{ event: 'billing.payment.captured', version: 1, consumer: 'ordering.mark-order-paid',
                               handler: 'MarkOrderPaidOnPaymentCaptured', module: 'ordering' }],
  domainEventHandlers: [],
  policies: [],
  jobs: [{ name: 'ordering.expire-carts', schedule: 'every 15m', overlap: 'skip', missed: 'skip', jitterMs: 0,
           enabled: true, singleInstance: true, job: 'ExpireCartsJob', module: 'ordering' }],
  projections: [{ name: 'ordering.order-list', projection: 'OrderListProjection', module: 'ordering',
                  applies: [{ kind: 'integration', event: 'billing.payment.captured', version: 1, method: 'paid' }] }],
  overrides: [],
}
```

Une entrée qui vient d'une déclaration porte aussi `origin: 'declared'`, `declaredBy` (la
classe) et, quand la découverte l'a chargée, `file`. Une entrée écrite dans un module est
`explicit` et ne porte aucun des trois :

```ts
{ token: 'InvoiceRepository', module: 'billing', kind: 'repository', lifetime: 'singleton',
  source: 'class', implementation: 'KnexInvoiceRepository', dependencies: ['Database'],
  overridden: false, origin: 'declared', declaredBy: 'KnexInvoiceRepository',
  file: '/app/dist/contexts/billing/infrastructure/persistence/knex-invoice.repository.js' }
```

`domainEventHandlers` liste les gestionnaires déclarés d'événements du domaine, *publishers*
compris, chacun avec sa `phase` (`before-commit` ou `after-commit`),
`policies` les classes de politiques déclarées, `jobs` les *jobs* avec les réglages sous
lesquels ils s'exécutent, ceux de l'application appliqués. Ce qu'un *job* a fait en dernier et
quand il s'exécute la prochaine fois n'est pas du câblage : demandez-le à
`app.resolve(JobScheduler).describe()`.

## Événements du domaine et unité de travail

Un effet d'un événement du domaine n'existe que si le changement d'état qui l'a consigné est
validé.

![La chronologie d'une commande : dans une seule transaction, le gestionnaire enregistre ses agrégats et leurs événements attendent dans une file, les gestionnaires before-commit s'exécutent sur la file une fois que le gestionnaire a rendu la main, puis la transaction est validée ; les gestionnaires after-commit s'exécutent après la validation, avant que la commande réponde](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/domain-and-integration-events-unit-of-work.fr.svg)

Au lieu de distribuer les événements dans le gestionnaire (derrière `kernelModule()`,
l'enregistrement les a déjà pris, si bien que cette ligne ne distribue rien ; sans lui, les
réactions s'exécuteraient hors du calendrier de l'unité de travail) :

```ts
await this.invoices.save(invoice);
await this.dispatcher.dispatch(invoice.pullEvents());
return invoice.id;
```

enregistrez l'agrégat, et arrêtez-vous là :

<!-- checked sample -->
```ts
import { AggregateRoot, Clock, Command, Repository, type CommandHandler, NamedDomainEvent } from '@ddd-ts-kit/kernel';

export class InvoiceIssued extends NamedDomainEvent('billing.invoice.issued') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {
    super();
  }
}

export class Invoice extends AggregateRoot {
  private constructor(id: string) {
    super(id);
  }

  static issue(id: string, issuedAt: Date): Invoice {
    const invoice = new Invoice(id);

    invoice.record(new InvoiceIssued(id, issuedAt));

    return invoice;
  }
}

export abstract class InvoiceRepository extends Repository<Invoice> {}

export class IssueInvoice extends Command<string> {
  constructor(readonly invoiceId: string) {
    super();
  }
}

export class IssueInvoiceHandler implements CommandHandler<IssueInvoice> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: IssueInvoice): Promise<string> {
    const invoice = Invoice.issue(command.invoiceId, this.clock.now());

    // L'enregistrement remet InvoiceIssued à l'unité de travail de la commande, qui le
    // distribue une fois que cette méthode a rendu la main, avant la validation.
    await this.invoices.save(invoice);

    return invoice.id;
  }
}
```

Un gestionnaire écrit `await this.orders.save(order); return order.id;` et rien d'autre : pas de
`pullEvents()`, pas de `DomainEventDispatcher` dans un cas d'usage. `kernelModule()` place
`dispatchingOnSave` du kernel autour de chaque liaison de nature `repository`, dans chaque
module : déclarée avec `@Repository`, liée `.as('repository')`, ou liée sous un port qui étend le
`Repository` du kernel (qui est un *repository*, que le module le dise ou non). Un adaptateur de
*repository* ne contient aucun code de distribution. L'enregistrement ne fait que remettre les
événements ; l'unité de travail de la commande les distribue à sa fin.

| Question | Réponse |
|---|---|
| Quelles méthodes | Chaque méthode du *repository* qui reçoit un agrégat, ou un tableau d'agrégats, et se résout : `save(order)`, `saveAll([a, b])`, `remove(order)`. Une méthode qui ne reçoit aucun agrégat (`findById`, `remove(id)`) n'annonce rien : une suppression qui annonce un événement prend l'agrégat |
| Quels événements, dans quel ordre | Ceux qu'ont consignés les agrégats de l'appel, retirés une fois l'appel résolu : dans l'ordre des arguments, puis de consignation, et à travers les enregistrements de la commande dans l'ordre des enregistrements |
| Quand | Une fois que le gestionnaire de commande a rendu la main, dans la transaction, avant la validation : le bus de commandes par défaut exécute le gestionnaire dans `UnitOfWork.run`, et un enregistrement ne fait que mettre en file. Chaque gestionnaire voit chaque enregistrement de la commande. Ce qu'écrivent les gestionnaires d'événements du domaine, l'outbox comprise, est validé ou annulé avec l'état |
| Après la validation | Les gestionnaires déclarés `phase: 'after-commit'` s'exécutent une fois la transaction validée, jamais quand elle a été annulée, dans l'ordre où les événements ont été distribués, attendus avant que la commande réponde. Au plus une fois : un plantage entre la validation et l'exécution les perd |
| Un gestionnaire `before-commit` échoue | La commande échoue avec ce qu'il a levé et l'unité de travail est annulée. Les événements encore en attente sont abandonnés, aucun gestionnaire `after-commit` ne s'exécute, et les instances d'agrégats ont rendu leurs événements : ne les enregistrez pas de nouveau, une nouvelle tentative les recharge |
| Un gestionnaire `after-commit` échoue | La commande réussit quand même. L'échec est journalisé (`Logger.error`, "A domain event handler failed after the commit", avec `domainEvent`, `errorType`, `errorCode`) et remis à l'`ErrorReporter` sous l'opération `after-commit <event name>` ; les autres gestionnaires s'exécutent quand même |
| L'enregistrement échoue | Rien n'est retiré : les événements restent sur l'agrégat. La commande échoue, et les événements mis en file par les enregistrements précédents sont abandonnés |
| Le gestionnaire de commande lève une erreur après un enregistrement, ou la validation échoue | Les événements en file sont abandonnés : aucun gestionnaire d'aucune phase pour un gestionnaire qui a levé une erreur, aucun gestionnaire `after-commit` pour une validation qui a échoué ; rien de stocké, aucune ligne d'outbox |
| Un gestionnaire enregistre un autre agrégat | Avant la validation : ses événements attendent derrière ceux déjà en file et sont distribués dans l'ordre de consignation, sans récursion. Après la validation : refusé avant l'écriture avec `SaveAfterCommitError` ; envoyez plutôt une commande par le `CommandBus` |
| Un gestionnaire envoie une commande | Avant la validation, cette commande rejoint l'unité de travail en cours : une distribution, à la fin de la plus externe, une validation. Après la validation, c'est une unité de travail à part |
| Le même agrégat enregistré deux fois | Le second enregistrement annonce ce qui a été consigné depuis le premier, ce qui peut n'être rien |
| Un enregistrement hors de toute unité de travail | Distribue avant de se résoudre, les gestionnaires `before-commit` puis les `after-commit`. Rien n'est alors atomique : l'état est écrit, les gestionnaires s'exécutent, et un gestionnaire qui échoue rejette l'enregistrement sans le défaire |
| Un adaptateur qui retire lui-même les événements | Ne laisse rien à distribuer : pas de double distribution, et pas de distribution du tout à moins que l'adaptateur la fasse. Un adaptateur n'appelle jamais `pullEvents()` |
| Ordre des enveloppes | Le plus externe d'abord : le hook `decorate`, l'instrumentation (le *span* de l'enregistrement), la remise des événements, les aspects que d'autres modules placent autour de la nature (`builder.around`), les aspects de la liaison (`.with(retry(...))`). Un enregistrement retenté annonce une seule fois |

Un gestionnaire `before-commit` ne peut avoir que des effets que couvre la transaction, parce que
la validation peut encore échouer après son exécution : `domain-events/transactional-before-commit`
y veille. Un effet hors de la base de données est un gestionnaire `after-commit` quand il peut
être perdu, un événement d'intégration par l'outbox quand il ne le doit pas :

```ts
@DomainEventHandler(InvoiceIssued, { phase: 'after-commit' })
export class InvoiceIssuedEventHandler implements DomainEventHandler<InvoiceIssued> {
  constructor(private readonly cache: Cache) {}

  async handle(event: InvoiceIssued): Promise<void> {
    await this.cache.delete(cacheKey<InvoiceSummary>('invoice-summary', event.aggregateId));
  }
}
```

Une `UnitOfWork` donnée par `kernelModule({ unitOfWork })` reçoit ce calendrier pour les
commandes, quoi qu'elle soit : le bus de commandes par défaut place `withinUnitOfWork` du kernel
autour d'elle. Bâtie elle-même sur `withinUnitOfWork`, comme le sont les *packages* d'ORM, elle
donne le même calendrier à un `run` appelé directement, celui d'un consommateur compris.

Dans une application de test, l'adaptateur d'un module et le *fake* donné pour un port de
*repository* annoncent tous deux à `app.domainEvents`, que `kernelModule()` soit listé ou non.
Sans conteneur, `dispatchingOnSave(repository, () => dispatcher)` du kernel est la même
enveloppe, et `createTestBuses().dispatching(fake)` de `@ddd-ts-kit/testing` l'applique à un
*fake*.

Un module place un aspect à lui autour de chaque liaison de certaines natures avec
`builder.around(kinds, (resolve) => aspect)` : à l'extérieur des aspects de chaque liaison, à
l'intérieur du hook `decorate`, le premier déclaré le plus à l'extérieur.

## Observer l'application

`kernelModule({ instrumentation })` prend ce qui observe l'application de l'extérieur : un objet
dont les membres sont des enveloppes, chacune optionnelle, appliquées là où la chose est
construite.

| Membre | Enveloppe |
|---|---|
| `binding` | chaque instance d'une liaison déclarée avec une nature, à l'extérieur de la distribution des événements du domaine |
| `useCase` | un *middleware* de bus, sur les deux bus par défaut, après la garde des cas d'usage et à l'extérieur de l'unité de travail ; il lit `info.context`, le module du gestionnaire |
| `publisher` | l'`IntegrationEventPublisher` |
| `consumer` | ce avec quoi chaque consommateur déclaré est abonné, informé de son nom de consommateur, de son module et de son type d'événement |
| `domainEvents` | le `DomainEventDispatcher` |
| `job` | chaque exécution d'un *job* déclaré, dans sa portée d'exécution, informée du nom du *job* et de son module |
| `errorReporter` | l'`ErrorReporter` |
| `executionScope` | informé de l'`ExecutionScope` une fois qu'il est construit |

`traceApplication()` de `@ddd-ts-kit/tracing` est un tel objet, et produit une trace lisible par
action ; ce *package* ne dépend d'aucune bibliothèque de traçage. Un port donné par une option de
`kernelModule` est enveloppé lui aussi ; un port lié de nouveau par un module ultérieur ne l'est
pas.

## Le hook `decorate`

`createApplication({ decorate })` reçoit chaque instance que crée une liaison, gestionnaires et
consommateurs compris, avec `{ token, context, kind? }` où `token` est la classe du port, et
renvoie l'instance à distribuer. C'est la place des enveloppes transverses d'un projet. Le traçage
passe plutôt par `kernelModule({ instrumentation })`, voir « Observer l'application ».

Une liaison prend ses propres enveloppes avec `.with(...)`, la première la plus à l'extérieur :

```ts
builder.bind(PaymentGateway).toClass(HttpPaymentGateway, [PaymentSettings]).as('external').with(retry({ attempts: 3 }), timeout(2000));
```

Un `BindingAspect` est `(instance, { kind?, className, context, token }) => instance`, où
`token` est le nom du port ; les aspects de `@ddd-ts-kit/aspects` conviennent tels quels, et son
`aspects(...)` construit un hook `decorate`. Le hook `decorate` vient autour des aspects d'une
liaison.

## Le conteneur tsyringe

`app.container` est le conteneur enfant tsyringe de l'application, pour l'interopérabilité. Un
port y est enregistré sous `tokenIdentity(port)`, un symbole, jamais sous la classe : tsyringe
essaierait de construire une classe qu'on lui demande, et une classe abstraite n'est pas l'un de
ses jetons.

```ts
import { tokenIdentity } from '@ddd-ts-kit/di';

app.container.isRegistered(tokenIdentity(Clock));          // true
app.container.resolve<Clock>(tokenIdentity(Clock));        // ce que renvoie app.resolve(Clock)
app.container.isRegistered(PlaceOrderHandler);             // false : lié lui aussi sous son identité
```

`app.resolve(Port)` est l'entrée typée, et celle qui signale un cycle ou un port non lié avec les
noms de ceux qui l'ont demandé.

## Contrôle d'accès

Un cas d'usage dit ce qu'il exige, ou dit qu'il est public : sur le message lui-même avec
`@Requires(permission)` ou `@Public()`, ou là où il est enregistré :

```ts
builder.command(IssueInvoice).requires(permissions['invoice.issue']).handledBy(IssueInvoiceHandler, [InvoiceRepository, Clock]);
builder.query(GetCatalog).public().handledBy(GetCatalogHandler, [Catalog]);
```

`.requires` n'existe que pour les messages qui portent un acteur (`AuthorizedCommand`,
`AuthorizedQuery` du kernel). Avec `createApplication({ modules, authorization: 'required' })`,
une application dont une commande ou une requête ne déclare ni l'un ni l'autre, d'aucune des deux
manières, ne démarre pas (`UNDECLARED_AUTHORIZATION`), et une application qui les déclare sans
module pour les faire respecter ne démarre pas non plus (`AUTHORIZATION_NOT_ENFORCED`).

Trois classes de ce *package* le portent :

| Classe | Est |
|---|---|
| `UseCaseGuard` | le port que les deux bus interrogent avant toute autre chose, l'unité de travail comprise : `check(message, next, info)`. Non lié, chaque message passe ; un module d'autorisation le lie |
| `UseCaseDeclarations` | une valeur, `{ list }` : ce que chaque commande et chaque requête a déclaré, pour qui le fait respecter |
| `DeclaredPolicies` | une valeur, `{ list }` : les classes `@Policy` des contextes, chacune résolue par sa classe |

Le contrôle lui-même et les autorisateurs vivent dans `@ddd-ts-kit/auth` (`authorizationModule`
de `@ddd-ts-kit/auth/di`). `ActorContext` est lié par `kernelModule()` ; l'application de test
prend une option `actor`, et laisse passer chaque message sauf si un module listé lie
`UseCaseGuard`.

## Limites

- Une classe joue un seul rôle : une déclaration par classe, et un adaptateur qui implémente deux
  ports est lié explicitement, une fois par port.
- Une classe fait une liaison : une classe de gestionnaire sert une instruction, une classe
  déclarée un module.
- Un décorateur de classe d'une autre bibliothèque qui remplace la classe (en renvoie une
  nouvelle) doit être écrit sous la déclaration, pour que la déclaration atterrisse sur la classe
  exportée. Un décorateur qui ne fait qu'annoter, comme `@Injectable()`, se compose dans un ordre
  comme dans l'autre.
- Une déclaration ne s'hérite pas : une sous-classe se déclare elle-même ou est liée
  explicitement.
- Ce que prend un constructeur parvient au conteneur par un fichier généré, jamais par des
  métadonnées du compilateur : une classe déclarée modifiée là où rien ne régénère ce fichier
  (`docs`, `generate`, le script `dev`) est refusée à la composition jusqu'à ce qu'il le soit.
- Une classe qui hérite de son constructeur a une `length` de zéro, si bien qu'une liste
  manquante pour elle ne peut pas se voir à l'exécution : `declarations/constructor-injection` de
  `ddd-ts-kit check` lit la classe de base du projet, et refuse celle qu'il ne sait pas lire.
- Un nom de consommateur, un nom de politique, un nom de *job* et le nom d'un événement du
  domaine sont écrits dans la déclaration ; ils ne sont pas dérivés de la classe, qu'un
  refactoring renomme.
- Un port à vous est identifié par sa classe : voir « Identité » pour un port chargé deux fois.
- Les fichiers découverts ne sont importés par rien. Dans un projet qui utilise la découverte,
  dites à knip que ce sont des entrées et à dependency-cruiser que ce ne sont pas des orphelins :

  ```jsonc
  // knip.json
  { "entry": ["src/main.ts", "src/contexts/*/{application,infrastructure}/**/*.{command,query,handler,integration-handler,publisher,event-handler,policy,job,projection,repository,gateway,adapter}.ts", "src/contexts/*/*.dependencies.ts"] }
  ```

  ```js
  // .dependency-cruiser.cjs, dans le pathNot de la règle no-orphans
  '\\.(command|query|handler|integration-handler|publisher|event-handler|policy|job|projection|repository|gateway|adapter|dependencies)\\.ts$'
  ```

  Avec un barrel et `contextModule`, aucun des deux réglages n'est nécessaire.
