[English](README.md) · **Français**
<!-- translation-of: README.md sha256:8f55426b0744941d -->

# @ddd-ts-kit/testing

Des tests lisibles sans *mocks* : des *builders* de données de test, des scénarios étant donné / quand / alors
pour les agrégats, un harnais en mémoire pour les gestionnaires (handlers), un harnais de bout en bout
en HTTP et sur le bus d'événements, et des suites de contrat qui tiennent les *fakes* (doubles de test)
et les vrais adaptateurs au même comportement. La logique métier se teste sans aucune infrastructure,
et les mêmes *builders* servent jusqu'aux tests qui exécutent toute l'application.

```
npm i -D @ddd-ts-kit/testing
```

| Entrée | Contient | Importe |
|---|---|---|
| `@ddd-ts-kit/testing` | *builders*, scénarios, `createTestBuses`, `InMemoryRepository` | aucun runner, aucune bibliothèque |
| `@ddd-ts-kit/testing/faker` | des données générées pour les *builders* | `@faker-js/faker` (*peer* optionnel) |
| `@ddd-ts-kit/testing/e2e` | client HTTP, `settled`, `eventually`, `collectEvents`, `pending` | Node seulement : aucun framework HTTP, aucun conteneur |
| `@ddd-ts-kit/testing/contracts` | les suites de contrat des ports du noyau, `ContractSuite` pour en écrire une autre | le runner que vous passez |
| `@ddd-ts-kit/testing/vitest` | `decorators()`, le *plugin* Vite qui permet à Vitest d'exécuter les décorateurs standard, et `decoratorCoverage()` | Node seulement ; exécute le `tsc` du projet |
| `@ddd-ts-kit/testing/coverage` | `governedCoverage()`, `governedJestCoverage()`, `unaffectedContexts()` : la couverture que mesure le runner et son plancher, lus dans `ddd-ts-kit.config.json` | Node seulement |
| `@ddd-ts-kit/testing/mutation` | `governedMutation()` : ce que Stryker mute, l'*ignorer* du kit qui écarte les textes des refus, les mutants statiques ignorés et le plancher, lus dans `ddd-ts-kit.config.json` | Node seulement |

L'entrée principale, `/contracts` et `/e2e` suivent les
[niveaux de test](../../docs/ARCHITECTURE.fr.md#7-niveaux-de-test) ; les *builders* servent à chaque niveau, et les
autres entrées se configurent une fois dans la configuration du runner :

![Les quatre niveaux de test et ce que le package donne à chacun : given / when / then, givenEvents, givenProcess et expectRefusal pour une spec du domaine ; createTestBuses, InMemoryRepository et les builders du contexte d'exécution pour une spec d'application ; les suites de contrat pour une spec d'adaptateur, exécutées sur le fake et sur le vrai adaptateur ; startTestServer, le client HTTP, expectProblem, collectEvents et eventually pour une spec de bout en bout. Les mêmes builders alimentent chaque niveau, et les entrées vitest, coverage et faker se configurent une fois dans la configuration du runner](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/testing-package-overview.fr.svg)

## Un premier test

Un agrégat, son *builder* et deux scénarios, dans un seul fichier pour la lecture (un projet donne à
l'agrégat son fichier sous `domain/` et au *builder* le sien sous `test/builders/`) :

<!-- checked sample -->
```ts
import { AggregateRoot, DomainRefusal, NamedDomainEvent } from '@ddd-ts-kit/kernel';
import { Builder, given, resetSequences, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { beforeEach, expect, it } from 'vitest';

// Le modèle sous test.
const OrderingCodes = { OrderAlreadyPaid: 'ORDER_ALREADY_PAID' } as const;

class OrderAlreadyPaid extends DomainRefusal {
  readonly code = OrderingCodes.OrderAlreadyPaid;

  static forOrder(orderId: string) {
    return OrderAlreadyPaid.refusal(`Order ${orderId} is already paid.`, { orderId });
  }
}

class OrderPaid extends NamedDomainEvent('ordering.order.paid') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly amount: number,
  ) {
    super();
  }
}

class Order extends AggregateRoot {
  private paid = false;

  private constructor(
    id: string,
    readonly amount: number,
  ) {
    super(id);
  }

  static place(id: string, amount: number): Order {
    return new Order(id, amount);
  }

  get isPaid(): boolean {
    return this.paid;
  }

  pay(at: Date): void {
    if (this.paid) {
      throw OrderAlreadyPaid.forOrder(this.id);
    }

    this.paid = true;
    this.record(new OrderPaid(this.id, at, this.amount));
  }
}

// Le builder : des valeurs par défaut valides une fois, puis des méthodes nommées dans le langage omniprésent.
const at = new Date('2026-03-01T10:00:00.000Z');

interface OrderProps {
  readonly id: string;
  readonly amount: number;
  readonly paid: boolean;
}

class OrderBuilder extends Builder<OrderProps, Order> {
  protected defaults(): Defaults<OrderProps> {
    return { id: sequence('order'), amount: 30, paid: false };
  }

  protected construct(props: OrderProps): Order {
    const order = Order.place(props.id, props.amount);

    if (props.paid) {
      order.pay(at);
    }

    return order;
  }

  paid(): this {
    return this.with('paid', true);
  }
}

const anOrder = (): OrderBuilder => new OrderBuilder();

// Les specs : une intention, puis les faits qu'elle a enregistrés ou le refus.
beforeEach(() => {
  resetSequences();
});

it('records the payment of a placed order', () => {
  given(anOrder())
    .when((order) => order.pay(at))
    .thenEvents([{ name: 'ordering.order.paid', amount: 30 }]);
});

it('refuses to pay an order twice', () => {
  given(anOrder().paid())
    .when((order) => order.pay(at))
    .thenError('ORDER_ALREADY_PAID', { orderId: 'order-1' })
    .thenState((order) => expect(order.isPaid).toBe(true));
});
```

Aucune base de données, aucun conteneur, aucun *mock* : le second test se lit « étant donné une commande
payée, quand elle est payée, alors elle est refusée avec `ORDER_ALREADY_PAID`, et elle est toujours payée ».
Les sections qui suivent reprennent chaque pièce tour à tour.

## Builders

Un *builder* déclare des valeurs par défaut valides une fois ; un test n'énonce que ce qui compte pour la
règle qu'il vérifie. Chaque étape rend un nouveau *builder*, immuable, si bien qu'un *builder* de base se
partage entre les tests.

Pour un agrégat, écrivez une classe : ses méthodes sont nommées dans le langage omniprésent (ubiquitous
language), et `construct` passe par l'API publique, si bien qu'un test ne peut jamais partir d'un état
invalide.

```ts
// contexts/ordering/test/builders/order.builder.ts
import { Builder, sequence, type Buildable, type Defaults } from '@ddd-ts-kit/testing';

interface OrderProps {
  id: string;
  customer: Customer;
  lines: readonly Line[];
  paid: boolean;
}

class OrderBuilder extends Builder<OrderProps, Order> {
  protected defaults(): Defaults<OrderProps> {
    return { id: sequence('order'), customer: aCustomer(), lines: [aLine()], paid: false };
  }

  protected construct(props: OrderProps): Order {
    const order = Order.place(props.id, props.customer, props.lines);
    if (props.paid) {
      order.pay();
    }
    return order;
  }

  placedBy(customer: Buildable<Customer>): this {
    return this.with('customer', customer);
  }

  withLine(line: Buildable<Line>): this {
    return this.adding('lines', line);
  }

  paid(): this {
    return this.with('paid', true);
  }
}

export const anOrder = (): OrderBuilder => new OrderBuilder();
```

```ts
const order = anOrder().paid().withLine(aLine().with('sku', 'sku-1')).build();
const orders = anOrder().placedBy(aCustomer().named('Ada')).buildMany(3);
```

![Comment un builder fabrique sa valeur : les valeurs par défaut déclarées une fois et ce que le test a énoncé sont fusionnés par props(), qui tire chaque valeur sequence, lazy et generated et construit chaque builder imbriqué ; build() remet les propriétés à construct, qui passe par l'API publique et donne un agrégat valide par construction, et buildRequest(), une méthode que le projet écrit sur son propre builder, donne, à partir des mêmes propriétés, le contenu de la requête HTTP d'une spec de bout en bout](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/testing-package-builder.fr.svg)

Pour des données simples (contenus de requête, DTO, objets-valeurs simples), la forme fonctionnelle suffit.
Elle donne les méthodes génériques `with(key, value)` et `withMany(partial)`, toutes deux vérifiées contre
les propriétés :

```ts
import { defineBuilder, lazy, sequence } from '@ddd-ts-kit/testing';

export const aLine = defineBuilder<Line>({
  defaults: { sku: sequence('sku'), quantity: 1 },
});

export const anEmail = defineBuilder<{ value: string }, Email>({
  defaults: { value: sequence('email', (n) => `user${n}@example.com`) },
  build: ({ value }) => Email.create(value),
});

aLine().with('quantity', 3).build(); // { sku: 'sku-1', quantity: 3 }
```

- Un *builder* est accepté partout où une valeur l'est : `.with('customer', aCustomer().named('Ada'))`,
  et dans les tableaux : `.with('lines', [aLine(), { sku: 'pen', quantity: 2 }])`.
- `sequence('order')` donne `order-1`, `order-2`... à chaque construction ; `lazy(() => new Date())`
  calcule une valeur par défaut à chaque construction. Une valeur donnée par `with` ne consomme rien.
- Appelez `resetSequences()` dans `beforeEach`, pour qu'un test ne dépende pas de ceux qui le précèdent.
- La forme en classe garde `with`, `withMany` et `adding` protégées à dessein : la surface publique
  d'un *builder* d'agrégat est le langage du domaine, pas les noms de ses propriétés.

Au lieu de créer l'objet entier dans chaque test, où la seule valeur dont dépend la règle se perd
parmi les autres, et où un nouvel argument de `Order.place` casse tous les tests :

```ts
const order = Order.place('order-1', { id: 'customer-1', name: 'Grace Hopper' }, [{ sku: 'sku-1', quantity: 1 }]);
order.pay();
```

écrivez ce dont parle le test, et laissez le *builder* tenir le reste en un seul endroit :

```ts
const order = anOrder().paid().build();
```

## Données générées

```
npm i -D @faker-js/faker
```

<!-- checked sample -->
```ts
import { defineBuilder, sequence } from '@ddd-ts-kit/testing';
import { generated } from '@ddd-ts-kit/testing/faker';

// Issu du domaine du contexte.
interface CustomerProps {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly birthDate: Date;
}

declare class Customer {
  static register(props: CustomerProps): Customer;
}

export const aCustomer = defineBuilder<CustomerProps, Customer>({
  defaults: {
    id: sequence('customer'),
    name: generated((faker) => faker.person.fullName()),
    email: generated((faker) => faker.internet.email().toLowerCase()),
    birthDate: generated((faker) => faker.date.birthdate({ mode: 'age', min: 18, max: 90 })),
  },
  build: (props) => Customer.register(props),
});

aCustomer().build();                              // un client différent, valide, à chaque construction
aCustomer().with('email', 'ada@example.com');     // énoncé : la règle sous test en dépend
```

Les valeurs par défaut sont générées, et pourtant valides : chaque générateur est contraint à ce que le
domaine accepte (un adulte, une adresse en minuscules), et `build` passe toujours par `Customer.register`.

**La règle : des données générées pour les champs dont un test ne se soucie pas, des valeurs explicites
pour ce dont dépend la règle sous test.** Un test n'affirme jamais une valeur générée qu'il n'a pas
énoncée, et ne compte jamais sur une valeur générée qui tomberait du bon côté d'une règle.

Au lieu de laisser au générateur la valeur dont parle la règle, si bien que le test passe grâce à une
valeur par défaut que personne ne lit :

```ts
it('lets an adult buy wine', () => {
  const customer = aCustomer().build();                               // adulte parce que la valeur par défaut le dit aujourd'hui
  expect(customer.mayBuy(wine, today)).toBe(true);
});
```

énoncez-la, avec une date que le lecteur peut vérifier :

```ts
it('lets an adult buy wine', () => {
  const customer = aCustomer().with('birthDate', new Date('2008-05-01')).build();
  expect(customer.mayBuy(wine, new Date('2026-05-01'))).toBe(true);  // 18 ans ce jour-là
});
```

Chaque valeur `generated` est tirée d'un seul générateur par fichier de test, `dataGenerator()`. Sa graine
vient de `TEST_SEED`, sinon elle est aléatoire, et elle est toujours connue (`dataGenerator().seed`) :

<!-- checked sample -->
```ts
// fichier de configuration initiale (setup) de vitest
import { beforeEach, onTestFailed } from 'vitest';
import { reportSeedOnFailure } from '@ddd-ts-kit/testing/faker';

reportSeedOnFailure({ beforeEach, onTestFailed });
// sous un test en échec : Generated data seed: 1837264. Replay this file with TEST_SEED=1837264.
```

| Appel | Fait |
|---|---|
| `generated((faker) => value)` | une valeur par défaut ou une valeur de `with` tirée à chaque construction |
| `dataGenerator()` | le générateur courant : `seed`, `faker`, `restart()` |
| `createDataGenerator({ seed?, locales?, referenceDate? })` | un générateur à part ; les dates relatives sont calculées à partir d'une `referenceDate` fixe, si bien qu'une graine les rejoue aussi |
| `useDataGenerator(generator)` | fait tirer `generated` de ce générateur, par exemple une graine fixe dans une suite |
| `reportSeedOnFailure(runner, log?)` | affiche la graine sous chaque test en échec |

## Scénarios

```ts
import { given, scenario } from '@ddd-ts-kit/testing';

it('records the payment of a placed order', () => {
  given(anOrder().withLine(aLine().with('quantity', 2)))
    .when((order) => order.pay())
    .thenEvents([{ name: 'ordering.order.paid', amount: 30 }]);
});

it('refuses to pay an order twice', () => {
  given(anOrder().paid())
    .when((order) => order.pay())
    .thenError('ORDER_ALREADY_PAID')
    .thenState((order) => expect(order.status).toBe('paid'));
});
```

`given` prend un agrégat ou son *builder* et écarte les événements de la mise en place
(`pullEvents()`), si bien que seuls les événements de `when` sont vérifiés. `scenario(() => aggregate)` fait
de même avec la mise en place sous forme de fonction, rejouée à partir d'un agrégat neuf à chaque `when`.

| Assertion | Passe quand |
|---|---|
| `thenEvents([...])` | exactement ces événements, dans l'ordre ; chacun décrit par son nom, sa classe, ou les propriétés qui comptent |
| `thenEventNames([...])` | exactement ces noms, dans l'ordre |
| `thenNoEvent()` | rien n'a été enregistré |
| `thenError(code)`, `thenError(code, facts)` | l'action a refusé avec ce code, quelle que soit la classe de l'erreur, en portant ces faits s'ils sont donnés (elle peut en porter d'autres) |
| `thenError(ErrorClass, code?)` | l'action a levé une instance de cette classe : pour une erreur qui est une classe à elle seule, comme les écrivait la 0.2 |
| `thenState((aggregate) => ...)` | vos propres assertions sur l'agrégat passent |

Les échecs sont des `AssertionError` de `node:assert`, avec les événements attendus et enregistrés côte à
côte, si bien qu'ils se lisent bien sous n'importe quel runner. Une erreur levée par `when` n'est jamais
avalée : toute assertion sauf `thenError` échoue sur elle. Quand `when` (ou la mise en place) est
asynchrone, la chaîne est une promesse : `await given(order).when(async (o) => ...).thenEventNames([...])`.

### Un agrégat en event sourcing

`givenEvents(rehydrate, events)` reconstruit l'agrégat en rejouant son historique, sans base de données,
et le scénario continue comme plus haut : une commande, puis les événements qu'elle a enregistrés ou le
refus.

```ts
givenEvents((id, history) => AttendanceRecord.rehydrate(id, history), [opened, noShowNoted, noShowNoted])
  .when((record) => record.noteNoShow('appointment-9', now))
  .thenEvents([NoShowNoted, AttendanceRecordBarred]);
```

`expectSnapshotEquivalence({ events, rehydrate, policy, state })` prouve les *snapshots* d'un agrégat :
pour chaque version de l'historique, l'agrégat reconstruit à partir du *snapshot* que sa politique
stockerait et des événements qui le suivent a l'état et la version du rejeu complet.

## Étapes de processus

```ts
import { givenProcess } from '@ddd-ts-kit/testing';

givenProcess<DeadlineState>(undefined)
  .when((current) => deadlines.requested(booked, current))
  .thenState({ appointmentId: 'appointment-1', confirmBefore: '2026-03-01T12:00:00.000Z' })
  .thenTimeouts([{ name: 'deadline', at: deadline }])
  .thenCommands([]);
```

Une étape d'un gestionnaire de processus est une fonction de son état et de ce qui s'est passé :
`givenProcess(state)` (ou `undefined` pour une instance qui n'existe pas) l'exécute et vérifie sa
décision sans stockage, sans file d'attente ni bus. `thenIgnored()`, `thenState(state)`,
`thenCommands([...])` (chacune par sa classe ou par les propriétés qui comptent), `thenTimeouts([...])`,
`thenCancelled([...])` et `thenEnded()` s'enchaînent ; un échec est une `AssertionError` qui dit ce qui
diffère.

## Refus

Un refus métier se reconnaît à son code, et porte ses faits sous forme de données : un test vérifie les
deux, jamais un message et jamais la classe d'un refus.

```ts
import { expectRefusal } from '@ddd-ts-kit/testing';

expectRefusal(() => calendar.slotFor('consultation', startsAt, now), 'BOOKING_TOO_LATE', { notice: 120 });
expectRefusal(Email.create('ada@'), 'INVALID_EMAIL');
await expectRefusal(() => commands.execute(command), 'SLOT_TAKEN', { calendarId: 'calendar-1' });
```

`expectRefusal(subject, code, facts?)` lit une action, qu'elle exécute, un `Result`, ou une erreur déjà
attrapée. Une action qui rend une promesse donne une promesse à attendre. Elle rend l'erreur, et échoue
avec une `AssertionError` qui nomme ce qui a été refusé à la place, ou les faits qui diffèrent, un par
ligne. Les faits donnés doivent être portés avec ces valeurs ; le refus peut en porter d'autres.

Au lieu de vérifier la formulation d'un message, qui casse quand on la reformule, ou la classe de
l'erreur, qui ne dit rien de ses faits et n'est pas ce que lit un client :

```ts
expect(() => order.pay(at)).toThrow('Order order-1 is already paid.');
expect(() => order.pay(at)).toThrow(OrderAlreadyPaid);
```

vérifiez le code, stable pour chaque client, et les faits que porte le refus :

<!-- checked sample -->
```ts
import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { expectRefusal } from '@ddd-ts-kit/testing';

const OrderingCodes = { OrderAlreadyPaid: 'ORDER_ALREADY_PAID' } as const;

class OrderAlreadyPaid extends DomainRefusal {
  readonly code = OrderingCodes.OrderAlreadyPaid;

  static forOrder(orderId: string) {
    return OrderAlreadyPaid.refusal(`Order ${orderId} is already paid.`, { orderId });
  }
}

const order = {
  id: 'order-1',
  pay(): void {
    throw OrderAlreadyPaid.forOrder(this.id);
  },
};

expectRefusal(() => order.pay(), 'ORDER_ALREADY_PAID', { orderId: 'order-1' });
```

## Gestionnaires

```ts
import { createTestBuses, InMemoryRepository, snapshots } from '@ddd-ts-kit/testing';

// domain/repositories/order.repository.ts : le port est une classe abstraite
export abstract class OrderRepository extends Repository<Order> {}

// test/fakes/in-memory-order.repository.ts : le fake implémente le port, il ne l'étend jamais
class InMemoryOrderRepository extends InMemoryRepository<Order> implements OrderRepository {
  constructor() {
    super(snapshots({ toSnapshot: (order) => order.toSnapshot(), fromSnapshot: Order.rehydrate }));
  }
}

it('places an order and announces it', async () => {
  const { commandBus, domainEvents, dispatching, eventBus, clock, ids, publishedEvents } = createTestBuses();
  const orders = dispatching(new InMemoryOrderRepository());
  const publisher = new OrderPlacedPublisher(eventBus, ids);

  domainEvents.on('ordering.order.placed', (event) => publisher.handle(event));
  commandBus.register(PlaceOrder, new PlaceOrderHandler(orders, ids, clock));

  const id = await commandBus.execute(new PlaceOrder('sku-1'));

  expect(orders.count()).toBe(1);
  expect(publishedEvents('ordering.order.placed')).toMatchObject([{ payload: { orderId: id } }]);
});
```

Le gestionnaire ne fait que sauvegarder : `await this.orders.save(order); return order.id;`.
`dispatching(fake)` donne au *fake* ce que l'application donne à chaque *repository* : une fois `save` (ou
toute méthode à qui l'on remet l'agrégat) résolu, les événements que l'agrégat a enregistrés sont remis
à `domainEvents`.

![Une spec de gestionnaire sur createTestBuses : la spec exécute une commande sur le bus de commandes, qui l'exécute dans l'unité de travail ; le vrai gestionnaire sauvegarde l'agrégat dans le fake du repository enveloppé par dispatching, qui garde une copie pendant que les événements enregistrés attendent ; une fois que le gestionnaire a rendu la main, domainEvents remet les événements à un gestionnaire before-commit, qui publie un événement d'intégration sur le bus d'événements en mémoire ; quand execute est résolu, la spec lit l'état du fake et les événements publiés](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/testing-package-handler-spec.fr.svg)

Une spec de gestionnaire a le minutage de la production. `commandBus` exécute chaque commande dans
`unitOfWork` (une `InMemoryUnitOfWork`), comme le fait le bus de l'application : les événements de chaque
sauvegarde attendent que le gestionnaire de la commande ait rendu la main, puis sont distribués dans
l'ordre où l'agrégat les a enregistrés, et `execute` se résout une fois que les gestionnaires des deux phases ont été
exécutés. Un gestionnaire qui échoue dans la phase `before-commit` fait rejeter `execute` ; rien n'est
défait, puisqu'il n'y a pas de transaction en mémoire. Appelé hors d'une commande, `orders.save(order)`
distribue avant de se résoudre.

```ts
domainEvents.on('ordering.order.placed', (event) => board.refresh(event.aggregateId), { phase: 'after-commit' });

await commandBus.execute(new PlaceOrder('sku-1'));       // se résout même quand le gestionnaire ci-dessus a échoué

expect(domainEvents.afterCommitFailures).toEqual([]);    // { error, event } de chaque échec, les cent derniers
```

Avec `createTestApplication` de `@ddd-ts-kit/di`, il n'y a rien à appeler : le *fake* donné pour un port
*repository* annonce à `app.domainEvents` avec le même minutage, et les gestionnaires d'événements du
domaine déclarés réagissent, chacun dans sa phase.

`InMemoryRepository` est un *fake*, pas un *mock* : un *repository* qui fonctionne, sur une Map, qui garde
sa propre copie de ce qui est sauvegardé (par `snapshots({ toSnapshot, fromSnapshot })` ou `{ clone }`) et
applique la concurrence optimiste sur `version`, en levant `ConcurrencyError` (code
`CONCURRENCY_CONFLICT`). Vérifiez son état avec `all()` et `count()`.

### Un fake, pas un mock

Au lieu d'un *mock*, qui vérifie les appels qu'a faits le gestionnaire et rien de leur effet :

```ts
const orders = { findById: vi.fn(), save: vi.fn() };
await new PlaceOrderHandler(orders, ids, clock).execute(new PlaceOrder('sku-1'));
expect(orders.save).toHaveBeenCalledTimes(1); // toujours vert si la commande ne pouvait jamais être relue
```

exécutez le vrai gestionnaire par le bus sur un *fake*, et vérifiez ce qui est vrai ensuite :

<!-- checked sample -->
```ts
import { AggregateRoot, Command, Repository, type Clock, type CommandHandler, type IdGenerator } from '@ddd-ts-kit/kernel';
import { createTestBuses, InMemoryRepository, snapshots } from '@ddd-ts-kit/testing';
import { expect, it } from 'vitest';

// Issu du domaine du contexte.
interface OrderSnapshot {
  readonly id: string;
  readonly sku: string;
}

declare class Order extends AggregateRoot {
  static place(id: string, sku: string, at: Date): Order;
  static rehydrate(snapshot: OrderSnapshot): Order;
  toSnapshot(): OrderSnapshot;
}

abstract class OrderRepository extends Repository<Order> {}

// Issu de la couche application : le cas d'usage sous test.
class PlaceOrder extends Command<string> {
  constructor(readonly sku: string) {
    super();
  }
}

class PlaceOrderHandler implements CommandHandler<PlaceOrder> {
  constructor(
    private readonly orders: OrderRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: PlaceOrder): Promise<string> {
    const order = Order.place(this.ids.next(), command.sku, this.clock.now());

    await this.orders.save(order);

    return order.id;
  }
}

// Issu de test/fakes/ : un repository qui fonctionne, tenu à la même suite de contrat que l'adaptateur.
class InMemoryOrderRepository extends InMemoryRepository<Order> implements OrderRepository {
  constructor() {
    super(snapshots({ toSnapshot: (order) => order.toSnapshot(), fromSnapshot: Order.rehydrate }));
  }
}

it('places an order', async () => {
  const { commandBus, dispatching, domainEvents, ids, clock } = createTestBuses();
  const orders = dispatching(new InMemoryOrderRepository());
  const heard: string[] = [];

  domainEvents.on('ordering.order.placed', async (event) => void heard.push(event.aggregateId));
  commandBus.register(PlaceOrder, new PlaceOrderHandler(orders, ids, clock));

  const id = await commandBus.execute(new PlaceOrder('sku-1'));

  expect((await orders.findById(id))?.toSnapshot()).toEqual({ id, sku: 'sku-1' });
  expect(heard).toEqual([id]);
});
```

Le *mock* casse quand le gestionnaire appelle une autre méthode du port pour le même effet, et reste vert
quand la commande sauvegardée ne peut pas être retrouvée ; le *fake* ne fait ni l'un ni l'autre. La règle
[`test/no-mocks`](../eslint-plugin/docs/rules/test-no-mocks.fr.md) signale `vi.fn`, `vi.mock` et leurs
semblables dans les tests d'un contexte.

### Quand un gestionnaire d'un événement échoue

`eventBus.publish` exécute chaque gestionnaire de l'événement, puis rejette avec une
`AggregateError` des échecs. `createTestBuses({ eventBusFailures: 'as-thrown' })` rejette avec
l'échec d'un seul gestionnaire tel quel, si bien qu'une spec affirme sa classe ou son `code`
(`rejects.toMatchObject({ code: 'CONCURRENCY_CONFLICT' })`) ; plusieurs échecs arrivent toujours
ensemble dans une `AggregateError`. Un projet créé par `ddd-ts-kit init` le règle dans ses
*worlds*, comme son application le fait sur son bus en processus ; ce sera la valeur par défaut
d'une prochaine version mineure.

### Qui agit

`createTestBuses()` donne aussi `executionScope` et `actorContext`, les deux doubles du noyau tenus
ensemble, pour les *fakes* et les adaptateurs qui renseignent les colonnes d'audit ou restreignent au
*tenant*. Par défaut : l'utilisateur `test-user`, la corrélation `test-correlation`, l'origine `test`.

```ts
import { aSession, anExecutionContext, createTestBuses, scoped } from '@ddd-ts-kit/testing';

const { executionScope } = createTestBuses({ executionContext: anExecutionContext().as(ada).build() });
const orders = new DrizzleOrderRepository(database, executionScope, clock);

await orders.save(order); // renseigné au nom d'ada, dans son tenant
await scoped(executionScope, anExecutionContext().as(bob).ofTenant('globex'), () => orders.findById(order.id));
```

| Builder | Par défaut | Dit |
|---|---|---|
| `aSession()` | la session d'un utilisateur à part, ouverte par mot de passe à l'instant de référence fixe des tests (*test epoch*), sans expiration | `of(actor)`, `identifiedBy`, `issuedAt`, `expiringAt`, `authenticatedBy`, `withSecondFactor`, `impersonatedBy`, `inLocale`, `inTimeZone`, `withExtensions` |
| `anExecutionContext()` | le travail d'un utilisateur à part, origine `test`, une corrélation à part | `as(actor)`, `inSession(session)`, `ofTenant`, `elevatedOver(tenants, reason?)`, `correlatedBy`, `causedBy`, `from(origin)`, `dueBy`, `inLocale`, `withExtensions` |

Ce sont deux classes sur `Builder`, immuables comme tout *builder*, et elles acceptent un *builder* partout
où l'on attend un acteur ou une session (`aSession().of(anActor().withRole('accountant'))` avec le
*builder* d'acteur de `@ddd-ts-kit/auth/testing`). `scoped(scope, context, work)` exécute un bloc dans un
contexte donné comme valeur ou comme *builder*, avec n'importe quel `ExecutionScope` ; `asTenant(scope,
'acme', work)` l'exécute comme membre d'un *tenant*, et `elevatedOver('all')` construit le contexte du
personnel de la plateforme sous une élévation, sans l'entrée d'audit qu'écrit `acrossTenants`.

## De bout en bout

Toute l'application, vrais adaptateurs compris, pilotée de l'extérieur : des requêtes HTTP en entrée, des
réponses et des événements d'intégration en sortie. Rien ici ne connaît le framework HTTP ni la façon dont
l'application est composée ; `start` le dit.

<!-- checked sample -->
```ts
import { createServer, type RequestListener } from 'node:http';
import { listenOnRandomPort, startTestServer } from '@ddd-ts-kit/testing/e2e';
import { afterAll } from 'vitest';

// Issu du projet : sa racine de composition, son framework HTTP, un jeton du fournisseur d'identité de test.
declare function composeApplication(): object;
declare function expressApp(app: object): RequestListener;
declare const testToken: string;

const app = composeApplication();                   // la racine de composition de main.ts
const server = await startTestServer({
  start: () => listenOnRandomPort(createServer(expressApp(app))),
  // Fastify : async () => ({ url: await fastify.listen({ port: 0 }), close: () => fastify.close() })
  headers: { authorization: `Bearer ${testToken}` },
});
afterAll(() => server.close());
```

| Appel | Fait |
|---|---|
| `createHttpClient(baseUrl)` | le client seul, pour un serveur que le projet démarre lui-même : ce qu'utilise le `test/e2e/support/start-application.ts` d'un projet généré, sur son propre `composeApplication(persistence, options)` |
| `client.get / post / put / patch / delete` | du JSON en entrée, `{ status, headers, body }` en sortie ; `body` est analysé quand le type de contenu est JSON, du texte sinon ; un 4xx ou un 5xx est une réponse, pas une exception |
| `client.post(path, body, { headers })`, `client.withHeaders(headers)` | des en-têtes pour un appel, ou un client pour un autre appelant |
| `expectStatus(response, 201)` | rend la réponse, ou échoue en montrant le corps, où l'API dit pourquoi |
| `expectProblem(response, { status, code, facts })` | vérifie une réponse RFC 9457 `application/problem+json` et rend le document ; `code` et `facts` sont optionnels, et `facts` nomme les faits que le document doit exposer, tels que JSON les écrit (une date est son texte ISO) |
| `settled(sources, { timeoutMs = 2000, intervalMs = 10 })` | se résout dès que chaque source ne compte plus de travail en attente ; quand le temps est écoulé, échoue en nommant chaque source qui attend encore, combien elle en tient et combien en a échoué |
| `eventually(assertion, { timeoutMs = 2000, intervalMs = 20 })` | réessaie jusqu'à ce que l'assertion passe ; quand le temps est écoulé, échoue en citant la dernière erreur |
| `pending(body)` | tient un scénario d'acceptation écrit avant son code : passe tant qu'une assertion de `body` échoue, échoue dès que `body` passe (retirer l'enveloppe) ou s'arrête sur autre chose qu'une assertion (le scénario est cassé) ; `it('#US5.02 AC1 ...', pending(async () => { ... }))` |
| `collectEvents(subscriber, types)` | enregistre les événements d'intégration publiés : `received(type?)`, `waitFor(type, predicate?, options?)`, `stop()` |

Les assertions sont celles de `node:assert` : elles se lisent de la même façon sous n'importe quel runner.

**Attendre ce qu'une requête HTTP a laissé derrière elle, jamais un temps fixe.** Ce qui se passe
après la réponse (l'outbox relayée, les gestionnaires qu'elle atteint, ce qu'ils enregistrent à leur
tour) s'attend avec `settled`, puis se vérifie aussitôt. Chaque source compte son travail en attente,
du moment où il commence jusqu'à ce qu'il soit fini : les `stats()` d'un store de l'outbox sont un
tel compte, puisqu'un enregistrement reste en attente pendant que le relais le publie et que les
gestionnaires qu'il atteint s'exécutent. Le `test/e2e/support/start-application.ts` d'un projet
généré l'offre en `application.settled()`, sur l'outbox de sa base de données. Un cas d'usage
qu'aucune route n'atteint, lancé par le gestionnaire d'un événement d'intégration de l'amont, est
lancé comme le ferait le relais de cet amont : `await application.publish([event])`, l'événement
construit depuis sa déclaration dans le langage publié, puis `await application.settled()`.

<!-- checked sample -->
```ts
import type { OutboxStore } from '@ddd-ts-kit/events';
import { collectEvents, expectStatus, settled, type HttpClient } from '@ddd-ts-kit/testing/e2e';
import type { IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { expect } from 'vitest';

// Du projet : le client de l'application, son outbox et l'endroit où ses événements s'entendent.
declare const client: HttpClient;
declare const outbox: OutboxStore;
declare const events: IntegrationEventSubscriber;

const issued = collectEvents(events, ['billing.invoice.issued']);

expectStatus(await client.post('/invoices', { customerId: 'customer-1' }), 201);
await settled({ outbox: () => outbox.stats() }); // "Still pending after 2000 ms: outbox: 1 (1 failed, waiting for a retry)"

expect(issued.received('billing.invoice.issued')).toHaveLength(1);
```

`settled` ne connaît que les sources qu'on lui donne : ce qu'un *broker* livre à ses consommateurs
après que le relais le lui a remis s'attend avec `collectEvents(...).waitFor`, et une projection lue
par l'API avec `eventually`.

**Préparer par l'API.** Un test de bout en bout crée son état comme le ferait un client, jamais en
écrivant des lignes. Le *builder* qui donne l'agrégat aux tests unitaires donne ici le contenu de la
requête HTTP, à partir des mêmes propriétés et du même vocabulaire :

```ts
class OrderBuilder extends Builder<OrderProps, Order> {
  // defaults(), construct() et les méthodes du langage omniprésent, comme plus haut

  buildRequest(): PlaceOrderRequest {
    const { customer, lines } = this.props();   // les valeurs par défaut et ce que le test a énoncé, résolus
    return { customerId: customer.id, lines };
  }
}

const { body: order } = expectStatus(await client.post<OrderView>('/orders', anOrder().withLine(aLine()).buildRequest()), 201);
```

**Remettre à zéro entre les tests.** Le harnais nomme le contrat et laisse l'implémentation au projet et à
son pilote :

<!-- checked sample -->
```ts
import type { DatabaseReset } from '@ddd-ts-kit/testing/e2e';
import { beforeEach } from 'vitest';

// PostgreSQL, avec n'importe quel client qui expose `query` : chaque table des schémas de l'application.
export function truncateAllTables(db: { query(sql: string): Promise<{ rows: { name: string }[] }> }, schemas: string[]): DatabaseReset {
  return {
    async reset() {
      const { rows } = await db.query(
        `select quote_ident(schemaname) || '.' || quote_ident(tablename) as name
           from pg_tables where schemaname in (${schemas.map((schema) => `'${schema}'`).join(', ')})`,
      );
      if (rows.length > 0) {
        await db.query(`truncate ${rows.map((row) => row.name).join(', ')} restart identity cascade`);
      }
    },
  };
}

declare const database: DatabaseReset; // truncateAllTables(pool, ['ordering', 'billing']), créé une fois

beforeEach(() => database.reset());
```

## Trois niveaux, le même vocabulaire

Une règle, « une commande déjà payée ne peut pas être payée de nouveau », à trois des quatre
[niveaux de test](../../docs/ARCHITECTURE.fr.md#7-niveaux-de-test) (le niveau de l'adaptateur, ce sont les
suites de contrat, plus bas). Le *builder* est le même ; seul change ce qui s'exécute en dessous.

```ts
// 1. Domaine : l'agrégat seul. Quelques millisecondes, aucun double.
it('refuses to pay an order twice', () => {
  given(anOrder().paid())
    .when((order) => order.pay(at))
    .thenError('ORDER_ALREADY_PAID');
});

// 2. Application : le vrai gestionnaire par le bus, des fakes pour les ports.
it('refuses to pay an order twice', async () => {
  const orders = new InMemoryOrderRepository();
  const app = createTestApplication({ modules: [orderingModule], fakes: [fake(OrderRepository, orders)] });
  const order = anOrder().paid().build();
  await orders.save(order);

  await expect(app.commandBus.execute(new PayOrder(order.id))).rejects.toMatchObject({ code: 'ORDER_ALREADY_PAID' });
  expect(app.eventBus.published).toEqual([]);
});

// 3. De bout en bout : HTTP, la vraie base de données et le vrai broker, des données générées, un état créé par l'API.
it('refuses to pay an order twice', async () => {
  const events = collectEvents(broker, [OrderPaid]);
  const { body: order } = expectStatus(await client.post<OrderView>('/orders', anOrder().buildRequest()), 201);
  expectStatus(await client.post(`/orders/${order.id}/payment`), 204);

  expectProblem(await client.post(`/orders/${order.id}/payment`), { status: 409, code: 'ORDER_ALREADY_PAID' });

  await events.waitFor(OrderPaid, (event) => event.payload.orderId === order.id);
  await eventually(async () => expect((await client.get<OrderView>(`/orders/${order.id}`)).body.status).toBe('paid'));
  expect(events.received(OrderPaid)).toHaveLength(1);
});
```

Le niveau 2 utilise `createTestApplication` et `fake` de `@ddd-ts-kit/di` : le port, une classe abstraite,
est ce sous quoi le *fake* est lié. Avec un autre conteneur, `createTestBuses()` ci-dessus donne les mêmes
bus sur lesquels enregistrer le gestionnaire. Au niveau 3, le client de `anOrder()` est généré, la ligne
de la commande est celle que donne la valeur par défaut, et les seules valeurs que le test énonce sont celles
dont dépend la règle : la commande est payée, puis payée de nouveau.

Quand plusieurs *specs* d'un contexte répètent la mise en place du niveau 2, l'application de test ou
les bus avec les mêmes *fakes*, elle s'écrit une fois dans `test/worlds/` du contexte :
`npx ddd-ts-kit generate test-world <context>` écrit `a<Name>World({ now, idPrefix, given })`, qui
construit chaque *fake* de `test/fakes/`, laisse `given` enregistrer ce dont la *spec* part, et rend
chaque *fake* sous le nom de son port ([Stratégie de test, mondes](../../docs/concepts/testing-strategy.fr.md#mondes)).

## Suites de contrat

Un *fake* ne mérite la confiance que s'il se comporte comme l'adaptateur qu'il remplace. Chaque suite
prend les fonctions du runner et une fabrique (factory), et s'exécute sur les deux.

![Une suite de contrat, deux sujets : repositoryContract exécute les mêmes tests sur le fake en mémoire, qu'utilisent les specs de gestionnaire, et sur l'adaptateur Drizzle sur une vraie base de données, qu'utilise la production ; les deux implémentent le port repository du domaine, si bien que ce qu'une spec de gestionnaire prouve sur le fake vaut pour la production](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/testing-package-contract-suite.fr.svg)

<!-- checked sample -->
```ts
// contexts/ordering/test/integration/order-repository.contract.spec.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AggregateRoot, Repository } from '@ddd-ts-kit/kernel';
import type { InMemoryRepository } from '@ddd-ts-kit/testing';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';

// Issu du contexte et de son dossier de test.
interface Line {
  readonly sku: string;
  readonly quantity: number;
}

declare class Order extends AggregateRoot {
  addLine(line: Line): void;
  toSnapshot(): object;
}

declare const anOrder: () => { build(): Order };
declare const aLine: () => { build(): Line };
// Le fake de la section Gestionnaires : il étend InMemoryRepository, il n'étend jamais le port.
declare class InMemoryOrderRepository extends InMemoryRepository<Order> {
  constructor();
}
declare function freshDrizzleRepository(): Promise<Repository<Order>>;

const runner = { describe, it, expect, beforeEach, afterEach };
const options = {
  createAggregate: () => anOrder().build(),
  mutate: (order: Order) => order.addLine(aLine().build()),
  idOf: (order: Order) => order.id,
  stateOf: (order: Order) => order.toSnapshot(),
};

repositoryContract(runner, { ...options, name: 'InMemoryOrderRepository', createRepository: () => new InMemoryOrderRepository() });
repositoryContract(runner, { ...options, name: 'DrizzleOrderRepository', createRepository: () => freshDrizzleRepository() });
```

| Suite | Tient |
|---|---|
| `repositoryContract` | enregistrer puis retrouver, id inconnu, mise à jour, isolement de la copie stockée, concurrence optimiste (toute erreur de code `CONCURRENCY_CONFLICT`) |
| `tenantIsolationContract` | un *repository* sous une stratégie d'isolement des *tenants* : ce qu'un *tenant* a enregistré est caché à un autre ; un autre *tenant* qui enregistre sous le même id le laisse intact, par une mise à jour ou (si `recreate(aggregate)` est donné, un nouvel agrégat sous le même id) par une insertion ; le personnel de la plateforme, avec une élévation sur tous les *tenants*, n'écrit rien, et lit l'agrégat de l'autre *tenant* quand `elevatedReads` est vrai (tables partagées, sécurité au niveau des lignes) ; une écriture d'un travail qui ne nomme aucun *tenant* est refusée (`NoCurrentTenantError`) et une lecture est refusée ou ne trouve rien. `createRepository(scope)` lit le *tenant* dans la portée qu'on lui donne, sur un stockage où existent les *tenants* `acme` et `globex`. Pour prouver la sécurité au niveau des lignes elle-même, exécutez-la sur un *repository* qui n'écrit aucune condition de *tenant* |
| `eventBusContract` | tout fournisseur d'`EventBus` : routage par type, plusieurs abonnés, désabonnement, aller-retour exact de l'enveloppe (`traceparent`, `correlationId`, `tenantId`), remontée de l'échec d'un gestionnaire. Les relivraisons sont acceptées ; rendez `settle()` depuis `createBus` pour les fournisseurs qui livrent de façon asynchrone |
| `unitOfWorkContract` | toute `UnitOfWork`, appelée par `run` sans bus de commandes : les événements du domaine attendent la fin et sont distribués avant la validation (commit), si bien que les gestionnaires voient chaque sauvegarde et que ce qu'ils écrivent, l'outbox comprise, est validé avec ; un échec dans une sauvegarde, dans le travail, dans un gestionnaire ou dans la validation (une contrainte différée) ne laisse rien derrière lui ; les gestionnaires `after-commit` s'exécutent une fois les lignes validées, jamais autrement. Un adaptateur qui n'est pas construit sur `withinUnitOfWork` échoue ici |
| `outboxStoreContract` | tout stockage d'outbox : ordre, limite, bail, prises concurrentes, publié, échoué, mort, `retryDead`, purge ; avec `carriesTenant: true`, le *tenant* de chaque événement conservé |
| `processedEventStoreContract` | tout `ProcessedEventStore` : une fois par consommateur et par événement, aussi sous des livraisons concurrentes |
| `eventStoreContract` | tout `EventStore` : un flux créé à la version 0 et relu dans l'ordre, numéroté à partir de 1, avec son type, sa version de forme, ses données, ses métadonnées et son instant ; un ajout à une version que le flux n'a plus (en retard ou en avance) refusé avec `CONCURRENCY_CONFLICT` et rien n'en est gardé ; un seul de deux ajouts à la même version passe ; des flux numérotés séparément ; tout le stockage lu dans l'ordre des ajouts, positions croissantes à partir de 1, après une position et dans une limite ; `head()` |
| `eventStoreUnitOfWorkContract` | un `EventStore` transactionnel avec l'outbox de sa base de données sous une même `UnitOfWork` : le flux et les enregistrements de l'outbox publiés pour ses événements sont validés ensemble ; rien ne reste dans l'outbox pour un ajout défait par un retour arrière (rollback), ni pour un ajout refusé par un conflit de concurrence. `createSubject()` rend `{ unitOfWork, store, outbox }` |
| `processStoreContract` | tout `ProcessStore` de gestionnaires de processus : une instance telle qu'enregistrée (état JSON, délais armés, fin), une version qui n'est pas la suivante refusée avec `CONCURRENCY_CONFLICT`, un seul de deux premiers enregistrements qui l'emporte, et avec `unitOfWork` rien de laissé par une sauvegarde défaite par un retour arrière (rollback) |
| `jobStoreContract` | tout `JobStore` de *jobs* en arrière-plan : les *jobs* dus, le plus ancien d'abord et chacun à une seule prise, les *jobs* différés, les clés d'idempotence restreintes au *tenant* (deux *tenants* n'en partagent jamais une), le *tenant* et le sujet que montre `find`, le bail et ses battements de cœur, les comptes rendus entendus seulement de la tentative qui tient le *job* (progression, point de reprise remis à la tentative suivante, succès, nouvelle tentative, mort et ranimé, libération), l'annulation d'un *job* en attente et d'un *job* en cours, la purge. Avec `unitOfWork` (sur le même contexte que le stockage qui vient d'être créé), un *job* ajouté, annulé ou ranimé dans une unité de travail qui revient en arrière (rollback) reste tel qu'il était, et un *job* dont l'unité de travail est validée est ajouté, annulé ou ranimé. Les prises demandent un bail de 30 s |
| `cacheContract` | tout `Cache` : aller-retour de chaque forme de valeur, isolement des entrées, suppression, durée de vie |
| `cachePurgerContract` | tout `CachePurger` avec son cache partagé (`store`, `holds`) : un tag purge ce qu'il nomme et rien d'autre, une sorte atteint chaque élément, les *tenants* restent séparés, la purge est idempotente |
| `lockContract` | tout `Lock` : un seul détenteur à la fois, aussi sous des demandes concurrentes, libération, expiration, une libération tardive ignorée, jeton de clôture (*fencing token*) croissant, `waitMs` |
| `jobSchedulerContract` | tout `JobScheduler` : enregistrement et description, un nom en double et une planification illisible refusés, `runNow` (aussi pour un *job* désactivé, un nom inconnu rejeté), rien par le temps avant `start` ni après `stop`, aucun chevauchement par défaut, un *job* en échec, signalé `failed` avec son code, pendant que les autres continuent, le contexte d'exécution d'une exécution |
| `loggerContract` | tout `Logger` : chaque niveau avec son message et des champs de toute forme, un niveau et un message qu'aucun champ ne contrefait, des enfants qui ajoutent leurs champs et s'imbriquent, des champs lus à chaque entrée, une entrée sous le niveau écartée sans lire aucun champ, `isLevelEnabled` qui répond ce qui est écrit (pour un enfant aussi), aucune exception sur un champ circulaire ou un *getter* qui lève, y compris au premier niveau des champs ; une `Error` passée comme champ écrite sous forme de sa description (`type`, `code` d'une `DomainError`, `message`, `stack` propre, `cause`, huit erreurs de profondeur au plus), son message remplacé quand le *logger* nettoie, sauf s'il s'agit d'une `DomainError` ; chaque entrée dans la destination une fois `flush()` résolu, puis aucune exception d'un appel de journalisation ni d'un second *flush*. `createLogger({ level, fields, scrubMessages })` rend le *logger* et `lines()`, ce que sa destination a reçu sous la forme `{ level, message, fields }`. Aucun indicateur de capacité : `InMemoryLogger` prend les trois mêmes options et passe toute la suite |
| `criteriaContract` | tout traducteur de critères, l'évaluateur en mémoire compris : une table de critères et les ids auxquels chacun répond, dans l'ordre, sur huit lignes fixes. Chaque opérateur sur chaque type auquel il s'applique, les décimaux comme des nombres, les instants à la milliseconde et à travers les fuseaux, la casse et les caractères sur lesquels un `LIKE` trébucherait, les nulls sous chaque opérateur, `and`, `or`, `not` et ce qu'une négation fait à un null, des tris avec égalités et nulls dans les deux sens, des pages par décalage avec leur total, chaque tri parcouru par curseur une et deux lignes à la fois, les quatre sortes de périmètre d'accès, et des valeurs hostiles. `createReadModel(rows)` rend `{ search(scopedCriteria) }` sur exactement ces lignes, lues avec `criteriaContractDefinition` |
| `readModelStoreContract` | toute `ReadModelTable` sous `TableReadModelStore` : des lignes de tout type en aller-retour, la ligne courante remise à un événement ultérieur, un événement appliqué une fois, jamais un événement plus ancien que la ligne, ordre par id d'événement au même instant et par version quand elle est donnée, des écritures concurrentes qui finissent sur la plus récente, des suppressions qui durent, la liste par critères et par périmètre, et `ProjectionRebuild` : reconstruit à partir de la source seule, aucun événement perdu pendant l'export (sur une ligne déjà copiée et sur une ligne pas encore copiée), des événements périmés et nouveaux après la bascule, des suppressions pendant et avant, un export en échec qui laisse la table telle qu'elle était, la table toujours elle-même après deux reconstructions. `createTable()` rend `{ table, unitOfWork }` ; `SourceOfTruth` est le *fake* de la source |
| `fileStorageContract` | tout `FileStorage` : aller-retour du contenu avec taille, type de média et somme de contrôle, plusieurs mébioctets en flux, une écriture au-delà de `maxBytes` refusée en laissant le contenu précédent, des clés qui pourraient sortir de leur place refusées, suppression, copie, déplacement, liste par préfixe, des liens signés de téléchargement et d'envoi (*upload*) qui expirent, refusent une signature modifiée ou un autre type de média, et ne sont jamais signés pour plus d'une heure, un téléchargement servi en pièce jointe même sans nom. `follow` envoie une requête HTTP à un lien : `fetch` par défaut, `followServed(storage)` pour un stockage que l'application sert |
| `rateLimiterContract` | tout `RateLimiter` : limite, `remaining` et `retryAfterMs`, appels refusés non comptés, fenêtre glissante, isolement des clés, appels concurrents |

Les suites du cache, du verrou, du limiteur de débit et du stockage de fichiers prennent aussi
`elapse(ms)`, qui fait passer le temps pour le sujet : avancez l'horloge qu'il lit, ou attendez vraiment
quand le temps est celui d'un serveur. La suite du planificateur de *jobs* le prend de `createScheduler`,
avec le planificateur et la portée dans laquelle il exécute ses *jobs* : `{ scheduler, scope, elapse }`. Elle
demande quelques secondes au plus, avec des *jobs* toutes les secondes.

La suite de l'unité de travail prend `createUnitOfWork`, appelée avant chaque test, qui rend une
`UnitOfWorkUnderContract` sur une table vide et une outbox vide :
`{ unitOfWork, outbox, insert(id), insertRefusedAtCommit(id), ids(), committedIds?(), close?() }`.
La table tient un identifiant sous une clé primaire et une référence à une ligne de la même table que la
base de données ne vérifie qu'à la validation (une contrainte différée) : `insertRefusedAtCommit` écrit
une ligne que la validation refuse. Donnez `committedIds`, ce que voit une autre connexion, là où la base
de données sert plusieurs connexions : la suite prouve alors aussi que les lignes d'un gestionnaire
`before-commit` sont invisibles de l'extérieur de la transaction et visibles des gestionnaires
`after-commit`.

Les suites n'utilisent que `describe`, `it`, `beforeEach`, `expect(...).toBe` et `toEqual`
(`afterEach` est optionnel), que fournissent les globales de vitest comme de jest : cette partie d'un
runner est le type `ContractRunner`.

Un *package* qui tient un port à lui publie son contrat sur la même base, `ContractSuite` : un sujet créé à
neuf avant chaque test, et `it`, `expect`, `afterEach` liés au runner.

<!-- checked sample -->
```ts
import { ContractSuite, type Awaitable, type ContractRunner } from '@ddd-ts-kit/testing/contracts';

// Le port que tient le package.
export interface Geocoder {
  locate(address: string): Promise<{ readonly latitude: number; readonly longitude: number } | undefined>;
}

export function geocoderContract(runner: ContractRunner, options: { name: string; create(): Awaitable<Geocoder> }): void {
  new GeocoderSuite(runner, () => options.create()).describe(`${options.name} (geocoder contract)`);
}

class GeocoderSuite extends ContractSuite<Geocoder> {
  protected tests(): void {
    this.it('answers undefined for an address it does not know', async () => {
      this.expect(await this.subject.locate('nowhere')).toBe(undefined);
    });
  }
}
```

## Les secrets qu'un adaptateur ne doit pas montrer

Un adaptateur est journalisé, étalé dans un diagnostic et sérialisé par du code qui ne sait rien de ce
qu'il contient. `expectNoSecret(adapter, [password, url])` vérifie qu'aucune des valeurs données ne
transparaît par `JSON.stringify`, un étalement d'objet, les valeurs auxquelles mène `Object.keys`, ou
`util.inspect` à toute profondeur, propriétés cachées comprises. L'échec nomme la vue et le rang du
secret, jamais sa valeur.

<!-- checked sample -->
```ts
import { KafkaEventBus } from '@ddd-ts-kit/kafka';
import { expectNoSecret } from '@ddd-ts-kit/testing';
import { it } from 'vitest';

declare const brokers: string;
declare const password: string;

it('shows no credential', () => {
  const bus = new KafkaEventBus({ brokers, client: { 'sasl.password': password } });

  expectNoSecret(bus, [password]);
});
```

## Décorateurs standard sous Vitest

Vitest 5 (Vite 8, Oxc) transforme les décorateurs historiques (legacy) et ne transforme pas les
décorateurs standard (TC39) : une *spec* qui importe un fichier `.ts` contenant `@CommandHandler(...)` ou
`@Retry(...)` s'arrête sur une erreur de syntaxe. `decorators()` comble cet écart, et seulement celui-là.

<!-- checked sample -->
```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { decorators } from '@ddd-ts-kit/testing/vitest';

export default defineConfig({ plugins: [decorators()] });
```

- **Ce qu'il fait.** Un fichier `.ts`, `.mts` ou `.cts` dont une ligne commence par un décorateur est
  compilé par le compilateur TypeScript du projet avant que le runner le lise ; tout autre fichier est
  laissé au runner. Les imports sont gardés tels qu'écrits, pour que le runner les résolve.
- **Quelles options il suit.** `target`, `useDefineForClassFields`, `verbatimModuleSyntax` et
  `experimentalDecorators`, lues dans le `tsconfig.json` le plus proche de chaque fichier (celui que suit
  aussi le runner), ou dans l'option `tsconfig`. Une cible `ESNext` laisserait les décorateurs en place,
  si bien que `ES2024` la remplace.
- **Il s'efface en mode historique.** Sous `experimentalDecorators: true`, il ne répond rien et le runner
  transforme lui-même les décorateurs. Un projet sur class-validator ou NestJS peut garder le *plugin* dans
  sa configuration ou l'enlever : le résultat est le même.
- **Source maps.** La *map* nomme le vrai fichier et contient son texte : les traces de pile, les points
  d'arrêt et la couverture pointent sur la source.
- **Cache.** Une entrée par contenu de fichier, compilateur et options, sous le répertoire de cache de
  Vite (option `cacheDir` pour le déplacer). Un fichier est compilé une fois, puis relu : environ 60 ms
  avec le TypeScript 7 natif et 220 ms avec TypeScript 6 la première fois, rien ensuite. Une
  entrée qui a perdu sa sortie ou sa *source map* (un nettoyage, une copie interrompue) est compilée
  à nouveau et remplacée.
- **Quel compilateur.** Le `tsc` du *package* `typescript` qu'installe le projet, à partir de la 5.6, le
  TypeScript 7 natif compris : il exécute le binaire du compilateur, pas son API JavaScript, que le
  compilateur natif n'a pas. `compiler` désigne un autre *package* ou un chemin.

| Option | Par défaut |
|---|---|
| `tsconfig` | le `tsconfig.json` le plus proche au-dessus de chaque fichier |
| `compiler` | `typescript` |
| `cacheDir` | `ddd-ts-kit-decorators` dans le répertoire de cache de Vite |

Il ne vérifie pas les types (le build s'en charge), et il ne touche pas aux fichiers `.tsx`.

## Seuils de couverture lus dans la configuration

`@ddd-ts-kit/testing/coverage` donne au runner de tests ce qu'il mesure et le plancher auquel il est tenu,
lus dans la clé `coverage` de `ddd-ts-kit.config.json` (la référence quand la clé est absente), si bien
qu'aucun seuil ne s'écrit dans une configuration de runner :

<!-- checked sample -->
```ts
// vitest.config.ts
import { governedCoverage } from '@ddd-ts-kit/testing/coverage';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  test: { coverage: { provider: 'v8', reporter: ['text', 'lcov'], ...governedCoverage(mode) } },
}));
```

- `include` : les couches de chaque contexte qu'exécute le lancement, y compris les fichiers qu'aucune
  *spec* ne charge. `--mode unit` mesure `domain`, `application` et `presentation`, `--mode integration`
  mesure `infrastructure`, tout autre mode les quatre.
- `exclude` : les `<layer>.declarations.ts` que le générateur écrit dans les couches d'un
  contexte déclaré, dérivés de l'arborescence et jamais chargés par une *spec* d'adaptateur.
- `thresholds` : une entrée par contexte et par couche qui contient un fichier source, et une par couche
  de chaque module de son modèle (`<module>/domain/`), si bien qu'un contexte ne peut pas se cacher
  derrière un autre, ni un module derrière un autre, et qu'une couche vide n'est tenue à rien jusqu'à son
  premier fichier.
- Un lancement partiel ne mesure et ne tient que les contextes nommés dans `DDD_TS_KIT_AFFECTED` (séparés
  par des virgules, tels que [`ddd-ts-kit affected`](../cli/README.fr.md#affected) les calcule pour une
  *pull request*) ; sans elle, le lancement couvre tous les contextes. `unaffectedContexts()` rend les
  répertoires des autres contextes, terminés par `/`, pour que le runner exclue leurs *specs* :
  ``exclude: unaffectedContexts().map((directory) => `${directory}**`)``.
- `governedJestCoverage()` donne la même chose sous la forme de `collectCoverageFrom` et `coverageThreshold`.
- `REFERENCE_COVERAGE` est la référence : domaine 90/85/90/90, application 85/80/85/85,
  présentation 80/70/80/80, infrastructure 70/60/70/70 (instructions, branches, fonctions, lignes).

En mode de décorateurs historique avec `emitDecoratorMetadata`, ajoutez `decoratorCoverage()` de
`@ddd-ts-kit/testing/vitest` à `plugins` : les instructions qu'écrit la transformation pour appliquer les
décorateurs contiennent, pour chaque type que nomme une classe décorée, une branche qu'aucun test ne peut
prendre ; le *plugin* les marque avec l'indication que lit le fournisseur `v8`, comme le fournisseur le
fait de lui-même pour SWC.

## Score de mutation lu dans la configuration

`@ddd-ts-kit/testing/mutation` donne à Stryker ce qu'il mute, ce qu'il laisse de côté et le plancher
auquel l'exécution est tenue, lus dans la clé `mutation` de `ddd-ts-kit.config.json` (80 pour la
couche domaine quand la clé est absente), de sorte que la config Stryker d'un projet n'écrit ni *glob*
ni nombre :

<!-- checked sample -->
```ts
// stryker.config.mjs
import { governedMutation } from '@ddd-ts-kit/testing/mutation';

export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.mutation.config.ts' },
  coverageAnalysis: 'perTest',
  ...governedMutation(),
};
```

- `mutate` : la couche domaine de chaque contexte, à son niveau et dans les modules de son modèle,
  les déclarations générées et les *specs* exclues.
- `appendPlugins` et `ignorers` : l'*ignorer* du kit, `refusal-texts`. Un test vérifie un refus par
  son code et jamais par son texte (`test/refusal-by-code`), donc un mutant d'un tel texte survivrait
  par construction : le message de `refusal(..)`, un texte passé à une fabrique d'une classe qui
  refuse (`InvalidSlot.forRule('ends after it starts')`), le message de `super(..)` dans une classe
  d'erreur et de `new ..Error(..)` sont écartés, avec la raison dans le rapport. Une classe refuse
  quand le fichier l'importe des erreurs de son contexte ou du kernel sous un nom qui le dit ; toute
  autre chaîne du domaine reste mesurée, le nom d'un événement, un statut, un code, une clé. Un texte
  qu'une fonction auxiliaire renvoie avant l'appel de la fabrique n'est pas reconnu : levez le refus
  là où la règle est vérifiée, ou laissez le survivant en vie et dites pourquoi.
- `ignoreStatic` : les mutants statiques, dans du code qui s'exécute une fois au chargement du
  module, sont ignorés ; une règle écrite en déclaration n'est prouvée que par le test qui l'énonce.
- `thresholds` : le plancher, auquel `ddd-ts-kit mutation` tient ensuite chaque contexte d'après le
  rapport json, les mutants ignorés affichés à côté de chaque score. `REFERENCE_MUTATION` est la
  référence : domaine 80.
- `incremental`, `incrementalFile` et `force` : une passe complète par défaut, la vérité de la nuit.
  Avec `DDD_TS_KIT_MUTATION_SINCE=<ref>` dans l'environnement, comme le *job* d'une *pull request* le
  fixe à la base de fusion du changement, la passe est incrémentale : les résultats du dernier
  rapport, gardés dans `reports/mutation/incremental.json`, sont réutilisés pour ce que le changement
  ne touche pas, et la passe coûte le temps de sa passe de tests initiale. Stryker ne compare que les
  sources mutées et les *specs*, donc la passe est forcée complète quand le changement touche un
  autre code dont les tests dépendent : un *fake*, un *builder*, un monde, la plateforme, une
  dépendance, une config.

## Voir aussi

- [Stratégie de test](../../docs/concepts/testing-strategy.fr.md) : pourquoi des *fakes* et pas des *mocks*,
  les quatre niveaux, quoi tester où
- [Runners de test](../../docs/tools/test-runners.fr.md) : Vitest ou Jest, et ce que chacun donne avec le kit
- [`@ddd-ts-kit/di`, tests](../di/README.fr.md#tests) : `createTestApplication` et `fake`, la spec
  d'application avec le conteneur
- [`@ddd-ts-kit/kernel`](../kernel/README.fr.md) : les agrégats, les ports et les adaptateurs en mémoire
  avec lesquels travaillent les *builders* et les *fakes*
