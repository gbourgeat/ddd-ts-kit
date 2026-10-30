[English](README.md) · **Français**
<!-- translation-of: README.md sha256:b6ec10d4ebb5b095 -->

# @ddd-ts-kit/drizzle

Les adaptateurs Drizzle des ports du noyau et des événements sur PostgreSQL : une unité de
travail que les *repositories* ne voient jamais, le store de l'outbox transactionnelle, le store
des événements traités, et un schéma de base de données par contexte délimité (bounded
context). Drizzle est la persistance par défaut du kit, pas une obligation : tout ici implémente
des ports, et un autre ORM est un autre adaptateur qui passe les mêmes suites de contrat.

```
npm i @ddd-ts-kit/drizzle drizzle-orm
```

Fonctionne avec tous les pilotes PostgreSQL de drizzle (node-postgres, postgres-js, PGlite,
Neon) : les fonctions sont génériques sur le type de la base, si bien qu'`executor()` est typé
exactement comme votre `db`.

## Sa place dans une application

Rien d'ici n'est importé depuis `domain/` ni `application/`. Un gestionnaire (handler) dépend du
port de *repository* de son domaine ; l'adaptateur de ce port, dans `infrastructure/`, exécute
ses instructions sur la `Database` du projet ; la plateforme construit l'unité de travail une
fois et la lie.

![Un contexte délimité contient un gestionnaire, le port de repository du domaine et le repository drizzle qui l'implémente ; createDrizzleUnitOfWork donne un seul objet qui est à la fois le UnitOfWork dans lequel le bus de commandes exécute chaque commande et la Database dont l'executor() sert aux requêtes du repository et des stores ; il ouvre db.transaction() sur une base drizzle de n'importe quel pilote PostgreSQL, dont les migrations drizzle-kit créent les tables](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/drizzle-place-in-an-application.fr.svg)

L'idée à retenir : **toute instruction passe par `executor()`**. Dans une unité de travail,
c'est la transaction de cette unité de travail : la ligne de l'agrégat, l'enregistrement
d'outbox de l'événement qu'il a publié et la marque d'événement traité d'un consommateur sont
validés ou annulés ensemble. Hors d'une unité de travail (une requête, un script), c'est la base
elle-même.

## Schéma

Les tables sont de simples définitions drizzle : exportez-les depuis les fichiers de schéma que
lit drizzle-kit, et vos propres migrations les créent.

<!-- checked sample -->
```ts
// platform/database/schema.ts
import { integer, text } from 'drizzle-orm/pg-core';
import { contextSchema, outboxTable, processedEventsTable } from '@ddd-ts-kit/drizzle/postgres';

export const outbox = outboxTable('messaging'); // messaging.outbox ; sans argument : public.outbox
export const processedEvents = processedEventsTable('messaging');

// contexts/order-management/infrastructure/persistence/order-management.schema.ts
export const orderManagement = contextSchema('order-management'); // schéma order_management
export const orders = orderManagement.table('orders', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  version: integer('version').notNull(),
});
```

`outbox` est indexée pour le relais (les enregistrements en attente par prochaine tentative,
index partiel) ; `processed_events` a `(consumer, event_id)` pour clé primaire.

## Racine de composition

`DrizzleContext` est la poignée sur laquelle les *repositories* et les stores exécutent leurs
requêtes. Il est générique sur la base drizzle : le projet nomme donc sa propre base par une
classe, qui est alors le jeton d'injection :

<!-- checked sample -->
```ts
// platform/database/database.ts
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { DrizzleContext } from '@ddd-ts-kit/drizzle/postgres';

export abstract class Database extends DrizzleContext<PgQueryResultHKT> {}
```

C'est la classe qu'écrit la CLI : typée sur la base neutre vis-à-vis du pilote, si bien que les
mêmes *repositories* tournent sur node-postgres en production et sur PGlite dans les tests, la
connexion étant typée `PgDatabase<PgQueryResultHKT>`. Un projet lié à un seul pilote peut nommer
sa sorte à la place (`DrizzleContext<NodePgQueryResultHKT>`), ce qui type exactement le résultat
brut d'`execute`.

`createDrizzleUnitOfWork(db)` donne un seul objet qui est à la fois le `UnitOfWork` du noyau et
cette `Database`. Liez-le aux deux :

```ts
// platform/database/persistence.module.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { defineContextModule } from '@ddd-ts-kit/di';
import { IntegrationEventPublisher, ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxStore } from '@ddd-ts-kit/events';
import {
  createDrizzleUnitOfWork,
  DrizzleOutboxStore,
  DrizzleProcessedEventStore,
} from '@ddd-ts-kit/drizzle/postgres';
import { Database } from '@/platform/database/database';
import { outbox, processedEvents } from '@/platform/database/schema';

const db: PgDatabase<PgQueryResultHKT> = drizzle(process.env.DATABASE_URL);
const unitOfWork = createDrizzleUnitOfWork(db);

export const persistenceModule = defineContextModule({
  name: 'persistence',
  register(builder) {
    builder.rebind(UnitOfWork).toValue(unitOfWork);
    builder.bind(Database).toValue(unitOfWork);
    builder
      .bind(OutboxStore)
      .toFactory((resolve) => new DrizzleOutboxStore(resolve(Database), { table: outbox }));
    builder
      .rebind(ProcessedEventStore)
      .toFactory((resolve) => new DrizzleProcessedEventStore(resolve(Database), { table: processedEvents }));
    builder.rebind(IntegrationEventPublisher).toClass(OutboxPublisher, [OutboxStore]);
  },
});
```

```ts
// main.ts
const app = createApplication({ modules: [kernelModule(), persistenceModule, contextModule('order-management', orderManagementDeclarations)] });
```

Placez le module après `kernelModule()` : `rebind` remplace ses valeurs par défaut en mémoire.
Le bus de commandes du module du noyau exécute chaque commande dans le `UnitOfWork` lié ; les
gestionnaires n'en savent rien. `contextModule` de `@ddd-ts-kit/di` transforme les classes
déclarées d'un contexte en son module.

Un projet écrit par la CLI contient le même câblage en deux fichiers :
`platform/database/persistence-over.ts` construit l'unité de travail et les deux stores une
fois, et `platform/composition/platform.module.ts` les lie, le *publisher* de l'outbox étant passé à
`kernelModule({ eventPublisher })`.

Les fabriques passent les tables du schéma `messaging`. Avec les tables dans `public`, les
stores n'ont besoin d'aucune option et la classe se lie directement :
`builder.bind(OutboxStore).toClass(DrizzleOutboxStore, [Database])`,
`builder.rebind(ProcessedEventStore).toClass(DrizzleProcessedEventStore, [Database])`.

Le relais lit le même store et remet les enregistrements au *broker* :

```ts
const relay = new OutboxRelay({ store: app.resolve(OutboxStore), publisher: broker, clock: app.resolve(Clock) });
relay.start({ intervalMs: 500 });
```

`unitOfWork.run(work)` ouvre `db.transaction` et garde la transaction dans un
`AsyncLocalStorage` ; un `run` imbriqué rejoint la transaction englobante. Comme `append`
utilise la transaction courante, un événement publié par un gestionnaire qui échoue ensuite est
annulé avec l'écriture métier : c'est toute la raison d'être de l'outbox.

`run` repose sur `withinUnitOfWork` du noyau. Les événements du domaine des agrégats enregistrés
à l'intérieur attendent que `work` ait rendu la main, puis sont distribués dans la transaction,
avant la validation (commit) : leurs gestionnaires voient chaque enregistrement, et ce qu'ils
écrivent est validé ou annulé avec. Si `work`, un gestionnaire ou la validation échoue, il ne
reste rien : aucune ligne, aucun enregistrement d'outbox, aucun gestionnaire exécuté après la
validation. Les gestionnaires déclarés `after-commit` s'exécutent une fois la transaction
validée. Un `run` imbriqué rejoint l'unité de travail en cours : une seule distribution, à la fin
de la plus externe. Un `run` appelé directement (un consommateur, un script) suit le même
déroulé qu'une commande. `unitOfWorkContract` de `@ddd-ts-kit/testing/contracts` le prouve sur
PGlite, avec une contrainte différée pour la validation qui échoue. Le README de
`@ddd-ts-kit/kernel` dessine ce déroulé
([Événements du domaine et unité de travail](../kernel/README.fr.md#événements-du-domaine-et-unité-de-travail)).

## Repository

Le port vit dans le domaine, l'adaptateur dans l'infrastructure. Un *repository* reçoit la base,
jamais une transaction : `executor()` est la transaction de l'unité de travail s'il y en a une,
et `db` sinon.

```ts
// Au lieu de : une transaction transmise par l'appelant, que chaque port et chaque gestionnaire porteraient alors
save(order: Order, transaction: PgTransaction<PgQueryResultHKT>): Promise<void>;

// Écrivez : la base, dont l'executor() est la transaction de l'unité de travail en cours
constructor(private readonly database: Database) {}
```

Côté domaine, un agrégat qui ne sait rien des lignes, et son port :

<!-- checked sample -->
```ts
import { AggregateRoot, DomainRefusal, Repository } from '@ddd-ts-kit/kernel';

// contexts/order-management/order-management.codes.ts
export const OrderManagementCodes = {
  OrderAlreadyPlaced: 'ORDER_ALREADY_PLACED',
} as const;

// contexts/order-management/domain/errors/order-already-placed.error.ts
export class OrderAlreadyPlaced extends DomainRefusal {
  readonly code = OrderManagementCodes.OrderAlreadyPlaced;

  static forOrder(orderId: string) {
    return OrderAlreadyPlaced.refusal(`Order ${orderId} is already placed.`, { orderId });
  }
}

// contexts/order-management/domain/order.aggregate.ts
export type OrderStatus = 'open' | 'placed';

export class Order extends AggregateRoot {
  private constructor(
    id: string,
    private status: OrderStatus,
  ) {
    super(id);
  }

  static open(id: string): Order {
    return new Order(id, 'open');
  }

  /** Reconstruit une commande enregistrée : réservé au mapper. */
  static rehydrate(id: string, status: OrderStatus): Order {
    return new Order(id, status);
  }

  get currentStatus(): OrderStatus {
    return this.status;
  }

  place(): void {
    if (this.status === 'placed') {
      throw OrderAlreadyPlaced.forOrder(this.id);
    }

    this.status = 'placed';
  }
}

// contexts/order-management/domain/repositories/order.repository.ts : findById et save viennent de Repository
export abstract class OrderRepository extends Repository<Order> {}
```

Côté infrastructure, la table, le *mapper* et l'adaptateur :

<!-- checked sample -->
```ts
// contexts/order-management/infrastructure/persistence/drizzle-order.repository.ts
import { and, eq } from 'drizzle-orm';
import { integer, text, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { contextSchema, DrizzleContext, optimisticUpdate } from '@ddd-ts-kit/drizzle/postgres';

// L'agrégat et son port de l'exemple précédent, réduits à leur forme.
type OrderStatus = 'open' | 'placed';
declare class Order extends AggregateRoot {
  static rehydrate(id: string, status: OrderStatus): Order;
  get currentStatus(): OrderStatus;
}
abstract class OrderRepository {
  abstract findById(id: string): Promise<Order | undefined>;
  abstract save(order: Order): Promise<void>;
}

// platform/database/database.ts : le jeton d'injection de la base
abstract class Database extends DrizzleContext<PgQueryResultHKT> {}

// order-management.schema.ts : la table de l'exemple de schéma, avec un statut typé
const orders = contextSchema('order-management').table('orders', {
  id: text('id').primaryKey(),
  status: text('status').$type<OrderStatus>().notNull(),
  version: integer('version').notNull(),
});

type OrderRow = typeof orders.$inferSelect;

// order.mapper.ts : la ligne ne quitte jamais l'infrastructure
const OrderMapper = {
  toDomain(row: OrderRow): Order {
    const order = Order.rehydrate(row.id, row.status);

    order.version = row.version; // la version qu'optimisticUpdate attendra

    return order;
  },

  toRow(order: Order, version: number): OrderRow {
    return { id: order.id, status: order.currentStatus, version };
  },
};

@Repository(OrderRepository)
export class DrizzleOrderRepository implements OrderRepository {
  constructor(private readonly database: Database) {}

  async findById(id: string): Promise<Order | undefined> {
    // executor() : la transaction de l'unité de travail en cours, ou la base hors d'une unité de travail
    const [row] = await this.database.executor().select().from(orders).where(eq(orders.id, id));

    return row === undefined ? undefined : OrderMapper.toDomain(row);
  }

  async save(order: Order): Promise<void> {
    const db = this.database.executor();

    await optimisticUpdate(order, async ({ expected, next }) => {
      const row = OrderMapper.toRow(order, next);
      const written =
        expected === 0
          ? await db.insert(orders).values(row).onConflictDoNothing({ target: orders.id }).returning({ id: orders.id })
          : await db
              .update(orders)
              .set(row)
              .where(and(eq(orders.id, order.id), eq(orders.version, expected)))
              .returning({ id: orders.id });

      return written.length; // 0 ligne : optimisticUpdate lève ConcurrencyError
    });
  }
}
```

Dans le style explicite, sans le décorateur, la même liaison tient en une ligne de
`<context>.module.ts` :
`builder.bind(OrderRepository).toClass(DrizzleOrderRepository, [Database])`.

`optimisticUpdate` donne la version attendue et la version à écrire, lève une
`ConcurrencyError` (une `DomainError` de code `CONCURRENCY_CONFLICT`) quand l'instruction gardée
n'a écrit aucune ligne, et fait avancer `order.version` sinon. Si votre base a été créée avec un
schéma relationnel (`drizzle(url, { schema })`), déclarez `Database` comme
`DrizzleContext<PgQueryResultHKT, typeof schema>` pour garder `executor().query`.

| `expected` | Instruction | Aucune ligne écrite signifie |
|---|---|---|
| `0` : jamais enregistré | `INSERT ... ON CONFLICT (id) DO NOTHING` | l'id est déjà pris |
| `n` | `UPDATE ... SET version = n + 1 WHERE id = ... AND version = n` | une autre transaction l'a enregistré depuis sa lecture |

La cible du conflit est l'id seul (`onConflictDoNothing({ target: orders.id })`) : sans elle,
PostgreSQL écarte aussi une ligne qui prend une valeur qu'une autre ligne détient sous une
contrainte d'unicité (un e-mail), et l'enregistrement se lit comme une mise à jour perdue.
Nommée, cette ligne est refusée par la base, et `optimisticUpdate` lève `UniqueViolationError`
(code `CONFLICT`, 409), comme pour une mise à jour qui prend une telle valeur.

## Colonnes d'audit, restriction au tenant et pages

Les formes de persistance standard du noyau, sur drizzle. `auditColumns()` et `tenantColumn()`
sont des *helpers* de colonnes à étaler dans une table : leurs clés sont celles des `AuditStamp`
et `TenantScoped` du noyau, si bien qu'un tampon s'étale tel quel dans une insertion, et les
colonnes portent les mêmes noms dans tous les projets (`created_at`, `created_by`,
`updated_at`, `updated_by`, `tenant_id`) : c'est ce qui permet d'écrire une seule fois un tableau
de bord, un export ou le *package* d'audit.

La table, puis le *repository*. Il lit par `tenantCondition` et écrit par `ownTenantCondition`,
les deux conditions de l'[Isolation des tenants](#isolation-des-tenants) :

<!-- checked sample -->
```ts
import { and, eq } from 'drizzle-orm';
import { index, integer, text, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { AggregateRoot, Clock, ExecutionScope, stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import {
  auditColumns,
  contextSchema,
  DrizzleContext,
  optimisticUpdate,
  ownTenantCondition,
  tenantColumn,
  tenantCondition,
} from '@ddd-ts-kit/drizzle/postgres';

// L'agrégat, son port et la base, réduits à leur forme.
type InvoiceStatus = 'draft' | 'issued';
declare class Invoice extends AggregateRoot {
  static rehydrate(id: string, amount: number, status: InvoiceStatus): Invoice;
  get amount(): number;
  get status(): InvoiceStatus;
}
abstract class InvoiceRepository {
  abstract findById(id: string): Promise<Invoice | undefined>;
  abstract save(invoice: Invoice): Promise<void>;
}
abstract class Database extends DrizzleContext<PgQueryResultHKT> {}

// contexts/billing-core/infrastructure/persistence/invoices.ts
export const invoices = contextSchema('billing-core').table(
  'invoices',
  {
    id: text('id').primaryKey(),
    amount: integer('amount').notNull(),
    status: text('status').$type<InvoiceStatus>().notNull(),
    version: integer('version').notNull(),
    ...tenantColumn(),
    ...auditColumns(),
  },
  // l'ordre des requêtes de liste, champ qui départage compris, pour qu'une page se lise dans l'index
  (table) => [index('invoices_tenant_amount_idx').on(table.tenantId, table.amount, table.id)],
);

/** Ce que l'agrégat dit de lui-même, plus la version à stocker : le reste de la ligne revient à l'adaptateur. */
interface VersionedInvoice {
  readonly id: string;
  readonly amount: number;
  readonly status: InvoiceStatus;
  readonly version: number;
}

@Repository(InvoiceRepository)
export class DrizzleInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const [row] = await this.database
      .executor()
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), tenantCondition(invoices.tenantId, this.scope)));

    if (row === undefined) {
      return undefined;
    }

    const invoice = Invoice.rehydrate(row.id, row.amount, row.status);

    invoice.version = row.version;

    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { id: invoice.id, amount: invoice.amount, status: invoice.status, version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.length;
    });
  }

  private insert(state: VersionedInvoice) {
    // tenant_id vient du travail en cours, created_* et updated_* de son acteur et de la Clock
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };

    const insertion = this.database.executor().insert(invoices).values(row);

    return insertion.onConflictDoNothing({ target: invoices.id }).returning({ id: invoices.id });
  }

  private update(state: VersionedInvoice, expected: number) {
    return this.database
      .executor()
      .update(invoices)
      .set({ ...state, ...stampUpdate(this.scope, this.clock) }) // laisse created_at et created_by intacts
      .where(
        and(
          eq(invoices.id, state.id),
          eq(invoices.version, expected),
          ownTenantCondition(invoices.tenantId, this.scope),
        ),
      )
      .returning({ id: invoices.id });
  }
}
```

Une requête de recherche prend la `PageRequest` du noyau et renvoie une `Page`, dans ses deux
variantes :

```ts
// contexts/billing-core/application/ports/invoice-queries.port.ts
export abstract class InvoiceQueries {
  abstract search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>>;
}
```

<!-- checked sample -->
```ts
// contexts/billing-core/infrastructure/persistence/drizzle-invoice-queries.reader.ts
import { and, asc, desc, eq, gt, lt, or, type SQL } from 'drizzle-orm';
import { index, integer, text, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  ExecutionScope,
  InvalidPageRequestError,
  decodeCursor,
  encodeCursor,
  pageOf,
  type CursorPageRequest,
  type OffsetPageRequest,
  type Page,
  type PageRequest,
  type SortDirection,
} from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { contextSchema, DrizzleContext, tenantColumn, tenantCondition } from '@ddd-ts-kit/drizzle/postgres';

// Le port de l'application, la base et la table des exemples précédents, réduits à leur forme.
interface InvoiceSummary {
  readonly id: string;
  readonly amount: number;
}
abstract class InvoiceQueries {
  abstract search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>>;
}
abstract class Database extends DrizzleContext<PgQueryResultHKT> {}
const invoices = contextSchema('billing-core').table(
  'invoices',
  { id: text('id').primaryKey(), amount: integer('amount').notNull(), ...tenantColumn() },
  (table) => [index('invoices_tenant_amount_idx').on(table.tenantId, table.amount, table.id)],
);

@Repository(InvoiceQueries)
export class DrizzleInvoiceQueries implements InvoiceQueries {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
  ) {}

  search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.byOffset(request) : this.byCursor(request);
  }

  private async byOffset(request: OffsetPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const db = this.database.executor();
    const own = tenantCondition(invoices.tenantId, this.scope);
    const rows = await db
      .select()
      .from(invoices)
      .where(own)
      .orderBy(...totalOrder(directionOf(request)))
      .limit(request.limit)
      .offset(request.offset);

    return pageOf(rows.map(toSummary), { total: await db.$count(invoices, own) });
  }

  private async byCursor(request: CursorPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const after = request.cursor === undefined ? undefined : beyond(positionOf(request.cursor), direction);
    const rows = await this.database
      .executor()
      .select()
      .from(invoices)
      .where(and(tenantCondition(invoices.tenantId, this.scope), after))
      .orderBy(...totalOrder(direction))
      .limit(request.limit + 1); // une ligne de plus que demandé : elle dit si une page suit
    const items = rows.slice(0, request.limit);
    const last = items.at(-1);
    const more = rows.length > request.limit && last !== undefined;

    return pageOf(items.map(toSummary), more ? { nextCursor: encodeCursor({ amount: last.amount, id: last.id }) } : {});
  }
}

const directionOf = (request: PageRequest<'amount'>): SortDirection => request.sort[0]?.direction ?? 'asc';

const toSummary = (row: typeof invoices.$inferSelect): InvoiceSummary => ({ id: row.id, amount: row.amount });

// La clé primaire suit le champ de tri, dans le même sens : l'ordre est total.
function totalOrder(direction: SortDirection): SQL[] {
  const toward = direction === 'asc' ? asc : desc;

  return [toward(invoices.amount), toward(invoices.id)];
}

// Les lignes après une position, en comparaison de tuples : le champ qui départage tranche entre égaux.
function beyond({ amount, id }: { amount: number; id: string }, direction: SortDirection): SQL | undefined {
  const past = direction === 'asc' ? gt : lt;

  return or(past(invoices.amount, amount), and(eq(invoices.amount, amount), past(invoices.id, id)));
}

// Un curseur revient d'un client : ce qu'il décode est vérifié avant d'atteindre une instruction.
function positionOf(cursor: string): { amount: number; id: string } {
  const { amount, id } = decodeCursor(cursor);

  if (typeof amount !== 'number' || typeof id !== 'string') {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }

  return { amount, id };
}
```

Un adaptateur de lecture sur la base de données se déclare avec `@Repository`, comme ceux que
génère la CLI : sa nature est `repository`. Déclaré avec `@Adapter`, il serait `external`, et
une plateforme générée entoure chaque adaptateur `external` et `gateway` d'une nouvelle
tentative (retry) et d'une limite de temps, ce qu'une instruction de l'unité de travail ne doit
pas recevoir.

Ce que font les deux sortes de page quand une ligne est insérée entre deux lectures :

![Des factures triées par montant puis par id : une page 2 par offset lue après une insertion montre inv-f une seconde fois, tandis qu'une page par curseur qui commence après la position (120, inv-f) de la dernière ligne de la page 1 montre les mêmes lignes quoi qu'on ait inséré avant elle, et lit une ligne de plus que la limite pour savoir qu'une page suit](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/drizzle-keyset-pages.fr.svg)

Les règles que tiennent ces exemples, et que les tests de ce *package* vérifient sur une vraie
base de données :

- **Les colonnes d'audit** sont remplies par l'adaptateur, jamais par l'agrégat :
  `stampCreation(scope, clock)` à l'insertion, `stampUpdate(scope, clock)` à la mise à jour, qui
  laisse `created_at` et `created_by` intacts. L'acteur est celui de la portée d'exécution :
  l'utilisateur de la requête HTTP, ou `system:<consumer>` pour un événement consommé.
- **Le tenant fait partie de chaque instruction** : écrit à l'insertion, et dans la condition de
  chaque lecture et de chaque mise à jour, garde de version comprise. Une ligne d'un autre
  *tenant* n'est pas trouvée, et une mise à jour qui la vise n'écrit rien, ce que
  `optimisticUpdate` signale par une `ConcurrencyError`. Un travail qui ne nomme aucun *tenant*
  lève `NoCurrentTenantError` avant tout SQL.
- **Une liste a un ordre total.** La clé primaire suit le champ de tri, dans le même sens, pour
  départager : sans elle, des lignes égales sur le champ de tri n'ont pas d'ordre défini, et une
  page pourrait en répéter ou en sauter une. L'index couvre `(tenant_id, <sort field>, id)`.
- **Un curseur est une position, pas un numéro de page** : la valeur de tri et l'id de la
  dernière ligne, écrits par `encodeCursor`, comparés comme un tuple (`amount > :amount OR
  (amount = :amount AND id > :id)`). Une ligne de plus que `limit` est lue pour savoir si une
  page suit, donc aucun comptage n'est nécessaire, et une ligne insérée avant le curseur ne
  décale pas la page suivante comme elle le fait avec un offset. Un curseur revient d'un client :
  `decodeCursor` refuse ce qu'il n'a pas écrit, et l'adaptateur vérifie les types de la position
  avant qu'ils n'atteignent une instruction.
- **Une page par offset répond `total`**, une page par curseur `nextCursor`. Proposez la forme
  par offset pour de petites listes que l'on parcourt, et la forme par curseur pour tout ce qui
  grandit.

## Isolation des tenants

Deux stratégies sur drizzle, toutes deux prouvées par `tenantIsolationContract` de
`@ddd-ts-kit/testing/contracts` ; le schéma par *tenant* et la base par *tenant* ne sont livrés
que pour knex ([Multitenance](../../docs/concepts/multitenancy.fr.md) en donne le tableau).

![La portée d'exécution nomme le tenant du travail ; première ligne de défense, le repository le met dans chaque instruction avec tenantCondition, ownTenantCondition et tenantScopeOf ; seconde ligne, l'unité de travail commence chaque transaction par tenantSession, qui fixe le tenant pour cette transaction seulement, et les politiques déclarées avec la table ne la laissent voir et écrire que les lignes de ce seul tenant](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/drizzle-tenant-isolation.fr.svg)

**Tables partagées.** Une colonne `tenant_id` (`tenantColumn()`) et la condition du kit dans
chaque instruction, au lieu d'une condition écrite à la main :

```ts
// Au lieu de : une condition écrite à la main, qu'une élévation du personnel de la plateforme ne peut pas élargir
.where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantScopeOf(this.scope).tenantId)))

// Écrivez, pour les lectures : le tenant du travail, ou les tenants d'une élévation
.where(and(eq(invoices.id, id), tenantCondition(invoices.tenantId, this.scope)))
// et pour les mises à jour et les suppressions : le seul tenant du travail, qu'une élévation n'élargit jamais
.where(and(eq(invoices.id, state.id), eq(invoices.version, expected), ownTenantCondition(invoices.tenantId, this.scope)))
```

La condition reste un argument direct de `where` ou de `and`, un `or` à côté d'elle,
`and(tenantCondition(...), or(a, b))` : sous un `or`, un `not` ou un gabarit `sql`, elle ne vaut
que pour une branche, et `tenancy/scoped-statement` de la CLI le signale. Les insertions étalent
`tenantScopeOf(this.scope)`. Un modèle de lecture de données d'un *tenant* passe `tenant: { scope, column: table.tenantId }` à `DrizzleReadModelTable` et à
`DrizzleReadModelStore`.

**Sécurité au niveau des lignes** (row-level security), la seconde ligne : les politiques (une
par commande SQL : un select voit la portée du travail, un insert, un update et un delete
seulement son propre *tenant*) sont déclarées avec la table, si bien que drizzle-kit les génère,
et l'unité de travail fixe le *tenant* de chaque transaction.

<!-- checked sample -->
```ts
// contexts/billing-core/infrastructure/persistence/invoices.ts
import { integer, text } from 'drizzle-orm/pg-core';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import {
  contextSchema,
  createDrizzleUnitOfWork,
  forceRowLevelSecurity,
  tenantColumn,
  tenantPolicies,
  tenantSession,
} from '@ddd-ts-kit/drizzle/postgres';

export const invoices = contextSchema('billing-core')
  .table(
    'invoices',
    {
      id: text('id').primaryKey(),
      amount: integer('amount').notNull(),
      version: integer('version').notNull(),
      ...tenantColumn(),
    },
    // tenant_isolation_select, _insert, _update et _delete : drizzle-kit les écrit dans la migration
    (table) => [...tenantPolicies(table.tenantId)],
  )
  .enableRLS();

// platform/database/persistence-over.ts : chaque transaction commence par fixer le tenant du travail
declare const db: PgDatabase<PgQueryResultHKT>;
declare const executionScope: ExecutionScope;

export const unitOfWork = createDrizzleUnitOfWork(db, undefined, { begin: tenantSession(executionScope) });

// La seule instruction que drizzle-kit n'écrit pas, pour une migration personnalisée (drizzle-kit generate --custom) :
// alter table "billing_core"."invoices" force row level security;
export const forced = forceRowLevelSecurity(invoices);
```

drizzle-kit n'impose pas les politiques au propriétaire de la table :
`forceRowLevelSecurity(invoices)` est l'instruction d'une migration personnalisée
(`drizzle-kit generate --custom`), ou bien l'application se connecte avec un rôle qui ne possède
pas les tables. Dans tous les cas, ce rôle n'est pas superutilisateur et n'a pas `BYPASSRLS`, et
chaque instruction s'exécute dans l'unité de travail : une instruction hors d'une transaction ne
porte aucun réglage et ne voit rien.

## Critères

`criteriaToDrizzle(plan, columns)` transforme un plan de critères du noyau en morceaux de
requête : `where` (les filtres, le périmètre de l'acteur et le *keyset* d'une page par curseur),
`counted` (les filtres et le périmètre seuls, pour un total), `orderBy` (l'ordre total terminé
par le champ qui départage), `limit` et `offset`. `predicateToDrizzle(predicate, columns)` donne
une condition. `columns` associe chaque champ du modèle de lecture à sa colonne, et c'est la
seule source d'identifiants : chaque valeur est un paramètre encodé par sa colonne, une
recherche textuelle est `like $1 escape $2`, avec `%`, `_` et `\` échappés.

Un port de lecture déclare ce qu'un appelant peut demander avec `defineCriteria` ; une requête
à vous sur la table d'un modèle de lecture planifie les critères, puis remet le plan au
traducteur :

<!-- checked sample -->
```ts
import { and, eq } from 'drizzle-orm';
import { text, timestamp, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { defineCriteria, pageOfPlan, planCriteria, type Page, type ScopedCriteria } from '@ddd-ts-kit/kernel';
import { contextSchema, criteriaToDrizzle, DrizzleContext, readModelColumns } from '@ddd-ts-kit/drizzle/postgres';

// application/ports/appointment-list.port.ts : la ligne, et ce par quoi un appelant peut filtrer et trier
export interface AppointmentRow {
  readonly id: string;
  readonly status: string;
  readonly startsAt: Date;
}

export const appointmentCriteria = defineCriteria<AppointmentRow>({
  fields: {
    id: { type: 'string' },
    status: { type: 'string', filter: ['eq', 'in'], sortable: true },
    startsAt: { type: 'instant', filter: ['gte', 'lt', 'between'], sortable: true },
  },
  defaultSort: [{ field: 'startsAt', direction: 'asc' }],
  tieBreaker: 'id',
});

abstract class Database extends DrizzleContext<PgQueryResultHKT> {}

// infrastructure/persistence/appointment-list.schema.ts
export const appointmentList = contextSchema('scheduling').table('appointment_list', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
  ...readModelColumns(), // last_event_id, last_event_at, last_event_version, deleted
});

// la seule source d'identifiants : un champ que la table de correspondance ne nomme pas n'atteint jamais une instruction
const COLUMNS = { id: appointmentList.id, status: appointmentList.status, startsAt: appointmentList.startsAt };

// infrastructure/persistence/drizzle-appointment-queries.reader.ts
export async function searchAppointments(
  database: Database,
  criteria: ScopedCriteria<AppointmentRow>,
): Promise<Page<AppointmentRow>> {
  const plan = planCriteria(appointmentCriteria, criteria); // refuse ce que la définition n'ouvre pas

  if (plan.empty) {
    return pageOfPlan(plan, []); // le périmètre d'accès n'atteint aucune ligne : aucune instruction du tout
  }

  const { where, counted, orderBy, limit, offset } = criteriaToDrizzle(plan, COLUMNS);
  const live = eq(appointmentList.deleted, false); // une ligne supprimée reste dans la table, marquée
  const db = database.executor();
  const rows = await db
    .select(COLUMNS)
    .from(appointmentList)
    .where(and(where, live))
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  // Une page par offset compte son total ; une page par curseur sait ce qui suit grâce à la ligne en trop.
  const total = plan.kind === 'offset' ? await db.$count(appointmentList, and(counted, live)) : undefined;

  return pageOfPlan(plan, rows, total);
}
```

Une page par curseur est lue avec une ligne de plus que demandé : c'est ainsi que `pageOfPlan`
sait si une autre suit ; une page par offset prend son total de `db.$count(table, counted)`,
passé en troisième argument de `pageOfPlan`. Un champ déclaré `nullable` est trié `nulls last`
en ordre croissant et `nulls first` en ordre décroissant.

**Chaînes.** Une colonne de texte est triée et comparée par intervalle selon la collation de la
colonne ; les critères trient les chaînes par point de code. Déclarez avec `COLLATE "C"` (un
`customType` dont le `dataType` est `text collate "C"`, ou la migration) les colonnes de texte
triées ou comparées avec `gt`, `lt` ou `between` : l'index sert alors le tri, et l'ordre est le
même que dans le *fake*. **Les décimaux** sont une colonne `numeric` et une chaîne dans la ligne ;
ils reviennent à l'échelle de la colonne. **Les instants** sont `timestamptz` et une `Date`. Un
entier est `integer` : un `bigint` revient du pilote sous forme de chaîne.

## Modèles de lecture

L'adaptateur d'un port de modèle de lecture étend `DrizzleReadModelStore` et n'ajoute rien : il
en reçoit `get`, `upsertIfNewer`, `delete` et `search`.

<!-- checked sample -->
```ts
import { text, timestamp, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { ReadModelStore, type CriteriaDefinition } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { contextSchema, DrizzleContext, DrizzleReadModelStore, readModelColumns } from '@ddd-ts-kit/drizzle/postgres';

// La ligne, ses critères et la base des exemples précédents, réduits à leur forme.
interface AppointmentRow {
  readonly id: string;
  readonly status: string;
  readonly startsAt: Date;
}
declare const appointmentCriteria: CriteriaDefinition<AppointmentRow>;
abstract class AppointmentList extends ReadModelStore<AppointmentRow> {}
abstract class Database extends DrizzleContext<PgQueryResultHKT> {}

// infrastructure/persistence/appointment-list.schema.ts
export const appointmentList = contextSchema('scheduling').table('appointment_list', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
  ...readModelColumns(), // last_event_id, last_event_at, last_event_version, deleted
});

// infrastructure/persistence/drizzle-appointment-list.repository.ts
@Repository(AppointmentList)
export class DrizzleAppointmentList extends DrizzleReadModelStore<AppointmentRow, PgQueryResultHKT> implements AppointmentList {
  constructor(database: Database) {
    super(database, {
      table: appointmentList,
      key: appointmentList.id,
      columns: { id: appointmentList.id, status: appointmentList.status, startsAt: appointmentList.startsAt },
      definition: appointmentCriteria,
    });
  }
}
```

Chaque écriture passe par `TableReadModelStore` du noyau : une ligne n'est écrite que si son
événement est plus récent que celui qu'elle porte, sur l'exécuteur de l'unité de travail, si
bien que la ligne et la marque d'événement traité sont validées ensemble. Une ligne supprimée
reste dans la table avec `deleted` posé : une requête à vous sur la table écarte ces lignes, et
un index unique aussi (`WHERE NOT deleted`). `store.table` est ce que prend
`ProjectionRebuild` ; la reconstruction est réservée à PostgreSQL (une copie `<table>__rebuild`
faite `LIKE ... INCLUDING ALL`, les clés écrites entre-temps dans `<table>__touched`, l'échange
par renommage en une transaction) et ses garanties et limites sont dans le README de
`@ddd-ts-kit/kernel` ([Reconstruction](../kernel/README.fr.md#reconstruction)).
Le store passe `criteriaContract` et `readModelStoreContract` de
`@ddd-ts-kit/testing/contracts`, sur PGlite et sur PostgreSQL 18.

## Effacement des données personnelles

L'effacement d'une personne concernée des tables d'un contexte, à partir des déclarations
`personalFields` écrites à côté de ses *mappers* (`@ddd-ts-kit/kernel`, « Données personnelles ») :
`DrizzlePersonalDataErasure` implémente le port `PersonalDataErasure` sur l'exécuteur de l'unité de travail. Le port du contexte étend celui du
kernel, et son adaptateur étend cette classe.

```ts
// infrastructure/persistence/person.personal-fields.ts : la table elle-même, les colonnes par les clés de sa définition
export const personPersonalFields = personalFields<typeof persons.$inferSelect, PgTable>(persons, {
  subject: 'id',
  fields: ['displayName', 'email'],
  erasure: 'row',
});

// infrastructure/persistence/drizzle-identity-erasure.repository.ts
@Repository(IdentityErasure)
export class DrizzleIdentityErasure extends DrizzlePersonalDataErasure<NodePgQueryResultHKT> implements IdentityErasure {
  constructor(database: Database, scope: ExecutionScope, files: FileStorage) {
    super(database, { name: 'identity.persons', declarations: [personPersonalFields], tenant: { scope }, files });
  }
}
```

`erase(subject)` supprime d'abord du stockage les fichiers que les lignes nomment, puis supprime les
lignes de la personne (`row`) ou les pseudonymise (`pseudonymise` : une colonne texte lit `[erased]`,
une colonne de tout autre type ne lit rien, une colonne de fichier rien), et répond combien de lignes
il a atteintes, aucune la seconde fois. Avec `tenant`, chaque instruction est confinée au *tenant* du
travail et jamais élargie par une élévation (la colonne nommée `tenant_id`, ou `tenant.column`) ; sans lui, la table tient les lignes de tous
les *tenants*. Un sujet qui n'est pas un identifiant opaque est refusé avant toute instruction, et une
déclaration qui nomme des colonnes de fichier sans stockage de fichiers est refusée à la construction
de l'adaptateur. Les types des colonnes viennent de la définition de la table, pour qu'un texte et un nombre soient pseudonymisés chacun à sa façon. Une colonne personnelle qui n'est pas un texte doit accepter null, sinon
les lignes s'effacent avec `row` : une déclaration qui en pseudonymiserait une qui ne l'accepte pas
est refusée avant qu'un fichier ou une ligne ne soit touché (`NotNullablePersonalColumnError`). L'adaptateur passe `personalDataErasureContract` de
`@ddd-ts-kit/testing`, comme celui en mémoire, sur PGlite et PostgreSQL. Ce qu'un effacement
n'atteint pas, et la chaîne entière (`eraseDataSubject` : la clé, chaque copie dans chaque *tenant*,
les reconstructions), sont dans le README du kernel (« Données personnelles »).

`DrizzlePersonalDataExport` répond au droit d'accès et à la portabilité à partir des mêmes déclarations :
`exportOf(subject)` remet un `PersonalDataRecord` par ligne sur la personne dans chaque table déclarée,
sous `<name>.<table>`, avec chaque colonne personnelle et chaque colonne de fichier (par sa clé) en
données simples, par les clés de la définition de la table, aucune autre colonne et rien de personne d'autre ; une ligne déjà
pseudonymisée répond ce qu'elle lit. La même option `tenant` confine chaque instruction au *tenant* du
travail, un sujet qui n'est pas un identifiant opaque est refusé avant toute instruction, et
l'adaptateur passe `personalDataExportContract`. Le port du contexte étend `PersonalDataExport` du
kernel et son adaptateur étend cette classe avec `name`, `declarations` et `tenant`
(`DrizzlePersonalDataExportOptions`) ; `generate repository --personal` écrit les deux adaptateurs, et
`exportDataSubject` du kernel rassemble chaque export en un document daté. Enveloppez l'adaptateur
avec `auditedPersonalDataExport` de `@ddd-ts-kit/audit` là où il est lié, pour que chaque remise
laisse une entrée.

Les mêmes déclarations donnent la limitation de la conservation (RGPD, article 5(1)(e)) : une
déclaration avec `retention: { after: 'endedAt', months: 36 }` dit combien de temps ses lignes gardent
la personne, compté depuis une colonne de date de la ligne, et `purgeExpired(now)` de l'adaptateur
d'effacement efface, comme la déclaration le dit, les lignes dont la date est plus ancienne que la
période ; une ligne dont la date est vide n'expire jamais, et un second passage n'atteint rien. Il
se confine au *tenant* du travail quand le travail en nomme un, et atteint chaque *tenant* quand il
n'en nomme aucun, comme le fait le *job* de nuit de la plateforme : un *tenant* oublié dans une liste
garderait ce qu'il ne doit pas. L'adaptateur implémente `PersonalDataRetention` du kernel et passe
`personalDataRetentionContract` ; `purgeExpiredPersonalData` du kernel lance chaque copie, et
`auditedPersonalDataRetention` de `@ddd-ts-kit/audit` enregistre chaque purge.

## Outbox et idempotence

- `DrizzleOutboxStore.claimBatch` sélectionne les lignes dues `FOR UPDATE SKIP LOCKED` et les
  prend à bail dans la même courte transaction en repoussant `next_attempt_at` (`leaseMs`, 30 s
  par défaut) : plusieurs relais se partagent ainsi le travail sans s'attendre, et les
  enregistrements d'un relais mort reviennent quand le bail expire. La livraison est au moins
  une fois et, par défaut, sans ordre : `ordering: 'per-key'` de `OutboxRelay`, muni d'un
  `keyOf` (en général l'identifiant de l'agrégat), garde dans l'ordre les enregistrements d'une
  même clé, avec un seul relais
  ([L'ordre par clé](../events/README.fr.md#lordre-par-clé)).
- `DrizzleProcessedEventStore.markProcessed` est un `INSERT ... ON CONFLICT DO NOTHING`.
  Exécutez le consommateur dans l'unité de travail : la marque est alors validée avec les effets
  du gestionnaire, et disparaît avec eux s'il échoue. `consume` de `@ddd-ts-kit/events` fait
  exactement cela ([Consommer de façon idempotente](../events/README.fr.md#consommer-de-façon-idempotente)).
- Un projet multitenant déclare `tenantOutboxTable('messaging')` au lieu d'`outboxTable` : la
  même table plus un `tenant_id` facultatif, que le store, quand on lui donne cette table,
  remplit avec le *tenant* de chaque événement, pour que ses consommateurs s'exécutent dans ce
  *tenant*. Faire basculer un projet existant tient en une migration générée qui ajoute la
  colonne.

## Event store

<!-- checked sample -->
```ts
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { createDrizzleEventSourcing, DrizzleContext, eventStoreTables } from '@ddd-ts-kit/drizzle/postgres';

// src/contexts/scheduling/infrastructure/persistence/scheduling.schema.ts, lu par drizzle-kit
export const { events, head, snapshots, checkpoints, subjectKeys } = eventStoreTables('scheduling');

// la racine de composition : la base du projet, puis un store par port
declare const database: DrizzleContext<PgQueryResultHKT>;

export const stores = createDrizzleEventSourcing(database, { schema: 'scheduling' });
// stores.events, stores.snapshots, stores.checkpoints, stores.subjectKeys
```

`eventStoreTables` déclare les tables que drizzle-kit crée dans une migration du projet, avec les
colonnes d'`eventStoreTablesSql` du noyau.

Chaque instruction s'exécute sur l'exécuteur du contexte : un ajout rejoint la transaction de
l'unité de travail, si bien que le flux et les enregistrements d'outbox que publient ses
événements sont validés ensemble (`eventStoreUnitOfWorkContract`). Les ajouts prennent la tête
du store, une ligne verrouillée jusqu'à la fin de leur transaction : les positions sont données
dans l'ordre des validations, sans trou, et deux ajouts ne s'exécutent jamais côte à côte, quels
que soient leurs flux. PostgreSQL seulement. Les stores sont ceux du noyau (`PostgresEventStore`
et ses compagnons), tenus ici à `eventStoreContract` ; comment un agrégat en *event sourcing*
les utilise : le README de `@ddd-ts-kit/kernel`, section
[Event sourcing](../kernel/README.fr.md#event-sourcing).

## Jobs en arrière-plan

`DrizzleJobStore` est le `JobStore` de `@ddd-ts-kit/scheduling` : les *jobs* en arrière-plan d'un
contexte dans `jobsTable('scheduling')`, que les fichiers de schéma de drizzle-kit incluent pour
qu'une migration la crée. `add` s'exécute sur l'exécuteur du contexte, dans la transaction de la
commande qui met en file ; les prises sélectionnent les lignes dues `FOR UPDATE SKIP LOCKED` et
les prennent à bail.

<!-- checked sample -->
```ts
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { kernelModule } from '@ddd-ts-kit/di';
import { createDrizzleUnitOfWork, DrizzleJobStore, DrizzleProcessStore, jobsTable, processesTable } from '@ddd-ts-kit/drizzle/postgres';

// scheduling.schema.ts, lu par drizzle-kit : scheduling.background_jobs et scheduling.process_instances
export const schedulingJobs = jobsTable('scheduling');
export const schedulingProcesses = processesTable('scheduling');

// la racine de composition
declare const db: PgDatabase<PgQueryResultHKT>;
const unitOfWork = createDrizzleUnitOfWork(db);

export const kernel = kernelModule({
  unitOfWork,
  jobStore: new DrizzleJobStore(unitOfWork, schedulingJobs),
  processStore: new DrizzleProcessStore(unitOfWork, { table: schedulingProcesses }),
});
```

Il passe `jobStoreContract`, sa suite d'unité de travail comprise, sur PGlite et, dans le *job*
d'intégration de la CI, sur PostgreSQL derrière un pool de cinq connexions, où les prises
concurrentes s'affrontent pour de bon. Ce que garantissent les *jobs* :
[Jobs en arrière-plan](../../docs/concepts/background-jobs.fr.md).

## Gestionnaires de processus

`DrizzleProcessStore` est le `ProcessStore` du noyau, sur `processesTable(schema)` : un premier
enregistrement insère, un suivant met à jour à la version précédente, et un enregistrement qui
ne change aucune ligne lève `ConcurrencyError`, dans la transaction de l'étape. Il passe
`processStoreContract`. L'exemple de [Jobs en arrière-plan](#jobs-en-arrière-plan) le lie avec
`kernelModule({ processStore })`.

Avec `tenant` (l'`ExecutionScope`), le store garde chaque instance dans le tenant du travail qui
l'enregistre : la table repère aussi une ligne par son tenant, le texte vide hors de tout tenant,
si bien que deux tenants peuvent utiliser la même clé de corrélation ; une instance d'un autre
tenant n'est ni trouvée ni modifiée, et un travail qui ne nomme aucun tenant est refusé par
`NoCurrentTenantError`.

## Tester un adaptateur

L'unité de travail de ce *package* passe `unitOfWorkContract`, et ses stores
`outboxStoreContract`, `processedEventStoreContract` et `jobStoreContract`, de
`@ddd-ts-kit/testing/contracts` sur PGlite (PostgreSQL dans le processus, sans conteneur).
Tenez vos *repositories* à `repositoryContract` de la même façon, à côté de leur *fake* en
mémoire.

Le traducteur de critères et le store de modèle de lecture tournent aussi sur un vrai serveur
quand `DDD_TS_KIT_TEST_DATABASE_URL` est définie, par `drizzle-orm/node-postgres`, chaque fichier
de *spec* dans sa propre base de données, qu'il supprime ensuite (dernière exécution :
PostgreSQL 18) :

```
DDD_TS_KIT_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres npx vitest run packages/drizzle
```

## Voir aussi

- [Persistance](../../docs/tools/persistence.fr.md) : choisir un ORM, et ce que chaque *package* d'adaptateurs a vérifié
- [Agrégats](../../docs/concepts/aggregates.fr.md#concurrence-optimiste) : la concurrence optimiste, vue depuis le domaine
- [L'outbox transactionnelle](../../docs/concepts/transactional-outbox.fr.md) : pourquoi l'enregistrement d'outbox est validé avec l'écriture métier
- [Multitenance](../../docs/concepts/multitenancy.fr.md#lisolation--quatre-stratégies) : les quatre stratégies d'isolation
- [`@ddd-ts-kit/typeorm`](../typeorm/README.fr.md) : les mêmes pièces sur TypeORM
