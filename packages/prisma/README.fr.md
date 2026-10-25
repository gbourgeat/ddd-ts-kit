[English](README.md) · **Français**
<!-- translation-of: README.md sha256:832d08ed4a85b04c -->

# @ddd-ts-kit/prisma

Les adaptateurs Prisma des ports du noyau et des événements : une unité de travail que les
*repositories* ne voient jamais, le registre de l'outbox transactionnelle, le registre des
événements traités, les tâches de fond et les instances des gestionnaires de processus, les
modèles de lecture des projections et la traduction des critères,
l'*event store*, et les modèles de leurs tables, sous forme d'un fragment de schéma à copier.
Les mêmes pièces que `@ddd-ts-kit/drizzle`, pour les projets sur Prisma.

```
npm i @ddd-ts-kit/prisma @prisma/client @prisma/adapter-pg
npm i -D prisma
```

Le *package* n'importe aucun code Prisma : il est typé structurellement d'après les quelques
méthodes qu'il appelle, si bien qu'il fonctionne avec votre client généré, où que vous le
génériez, et avec un client étendu (`$extends`). PostgreSQL d'abord ; voir
[Couverture des dialectes](#couverture-des-dialectes) pour MySQL et SQLite.

## La place dans une application

Rien ici n'est importé depuis `domain/` ou `application/`. Un gestionnaire (handler) dépend de
ports du noyau (`UnitOfWork`, `IntegrationEventPublisher`) et de son domaine (un *repository*) ;
ce *package* donne les adaptateurs des ports du noyau, votre `infrastructure/` écrit par-dessus
les adaptateurs des ports du domaine, et la plateforme les lie tous au démarrage.

![L'adaptateur PrismaInvoiceRepository du projet implémente le port InvoiceRepository qu'appelle un gestionnaire de commande, et interroge database.client() ; le package donne l'unité de travail (liée à UnitOfWork et à Database), le registre des événements traités et le registre de l'outbox, où sont ajoutés les événements du gestionnaire ; l'OutboxRelay de @ddd-ts-kit/events les réclame et les publie vers le broker ; chaque instruction passe par le client Prisma généré jusqu'à PostgreSQL](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/prisma-place-in-an-application.fr.svg)

| Pièce | Ce qu'elle fournit | Section |
|---|---|---|
| `createPrismaUnitOfWork(prisma)` | `UnitOfWork` du noyau, et le `PrismaContext` que votre `Database` étend | [Racine de composition](#racine-de-composition) |
| `optimisticUpdate`, `ConcurrencyError` (du noyau) | la garde de version de vos *repositories* | [Repository](#repository) |
| `criteriaToPrisma`, `predicateToPrisma` | les arguments d'un `findMany` pour des critères | [Critères](#critères) |
| `PrismaReadModelStore` | le port de modèle de lecture d'une projection (`TableReadModelStore`) | [Modèles de lecture](#modèles-de-lecture) |
| `PrismaOutboxStore` | `OutboxStore` de `@ddd-ts-kit/events` | [Outbox et idempotence](#outbox-et-idempotence) |
| `PrismaProcessedEventStore` | `ProcessedEventStore` du noyau | [Outbox et idempotence](#outbox-et-idempotence) |
| `PrismaJobStore` | `JobStore` de `@ddd-ts-kit/scheduling` | [Tâches de fond et instances de processus](#tâches-de-fond-et-instances-de-processus) |
| `PrismaProcessStore` | `ProcessStore` du noyau | [Tâches de fond et instances de processus](#tâches-de-fond-et-instances-de-processus) |
| `createPrismaEventSourcing(context)` | l'*event store*, les *snapshots*, les points de reprise et les clés de sujet du noyau | [Event store](#event-store) |
| `schemaNameOf(context)` | le nom de schéma d'un contexte délimité (bounded context) | [Schéma](#schéma) |

## Schéma

Prisma n'a qu'un schéma, le vôtre. Le *package* livre les modèles à y copier, un fichier par
fournisseur :

```
node_modules/@ddd-ts-kit/prisma/prisma/outbox.postgresql.prisma
node_modules/@ddd-ts-kit/prisma/prisma/outbox.mysql.prisma
node_modules/@ddd-ts-kit/prisma/prisma/outbox.sqlite.prisma
```

```prisma
// prisma/schema.prisma (fragment PostgreSQL)
model OutboxRecord {
  id            String    @id
  sequence      BigInt    @unique @default(autoincrement())
  type          String
  version       Int
  occurredAt    String    @map("occurred_at")
  payload       Json?
  traceparent   String?
  correlationId String?   @map("correlation_id")
  status        String    @default("pending")
  attempts      Int       @default(0)
  nextAttemptAt DateTime  @map("next_attempt_at") @db.Timestamptz(3)
  lastErrorCode String?   @map("last_error_code")
  publishedAt   DateTime? @map("published_at") @db.Timestamptz(3)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([status, nextAttemptAt, sequence])
  @@map("outbox")
}

model ProcessedEvent {
  consumer    String
  eventId     String   @map("event_id")
  processedAt DateTime @default(now()) @map("processed_at") @db.Timestamptz(3)

  @@id([consumer, eventId])
  @@map("processed_events")
}
```

`prisma migrate dev` crée ensuite les tables dans une migration de votre projet. Gardez les
noms des champs, les registres sont typés d'après eux ; les noms des modèles, des tables et des
colonnes sont les vôtres.

Un schéma par contexte délimité : listez les schémas dans la *datasource*, placez chaque modèle
dans le sien avec `@@schema`, et donnez un nom de modèle propre à un contexte qui garde sa
propre outbox. `schemaNameOf('billing-core')` donne le nom à écrire, `billing_core`.

```prisma
datasource db {
  provider = "postgresql"
  schemas  = ["messaging", "billing_core"]
}

model MessagingOutboxRecord {
  // ...les champs ci-dessus
  @@map("outbox")
  @@schema("messaging")
}

model Invoice {
  id      String @id
  amount  Int
  status  String
  version Int

  @@map("invoices")
  @@schema("billing_core")
}
```

Les contextes ne relient jamais leurs modèles entre eux : aucune `@relation` d'un schéma à
l'autre.

## Racine de composition

`PrismaContext` est le client sur lequel les *repositories* et les registres exécutent leurs
requêtes SQL. Il est générique sur le client de transaction de votre client généré : le projet
nomme donc sa propre base de données par une classe, qui sert alors de jeton d'injection :

```ts
// platform/database/database.ts
import { PrismaContext } from '@ddd-ts-kit/prisma';
import type { Prisma } from '$generated/prisma/client';

export abstract class Database extends PrismaContext<Prisma.TransactionClient> {}
```

`createPrismaUnitOfWork(prisma)` donne un seul objet, qui est à la fois l'`UnitOfWork` du noyau
et cette `Database`. Liez-le aux deux :

```ts
// platform/database/persistence.module.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { defineContextModule } from '@ddd-ts-kit/di';
import { IntegrationEventPublisher, ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxStore } from '@ddd-ts-kit/events';
import {
  createPrismaUnitOfWork,
  PrismaOutboxStore,
  PrismaProcessedEventStore,
} from '@ddd-ts-kit/prisma';
import { PrismaClient } from '$generated/prisma/client';
import { Database } from '@/platform/database/database';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const unitOfWork = createPrismaUnitOfWork(prisma);
const outboxStore = new PrismaOutboxStore(unitOfWork, {
  delegate: (client) => client.messagingOutboxRecord,
  claim: { strategy: 'skip-locked', dialect: 'postgresql', schema: 'messaging', raw: (client) => client },
});

export const persistenceModule = defineContextModule({
  name: 'persistence',
  register(builder) {
    builder.rebind(UnitOfWork).toValue(unitOfWork);
    builder.bind(Database).toValue(unitOfWork);
    builder.bind(OutboxStore).toValue(outboxStore);
    builder.rebind(ProcessedEventStore).toFactory(
      (resolve) =>
        new PrismaProcessedEventStore(resolve(Database), { delegate: (client) => client.messagingProcessedEvent }),
    );
    builder.rebind(IntegrationEventPublisher).toClass(OutboxPublisher, [OutboxStore]);
  },
});
```

```ts
// main.ts
const app = createApplication({ modules: [kernelModule(), persistenceModule, contextModule('billing', billingDeclarations)] });

const relay = new OutboxRelay({ store: app.resolve(OutboxStore), publisher: broker, clock: app.resolve(Clock) });
relay.start({ intervalMs: 500 });
```

Listez le module après `kernelModule()` : `rebind` remplace ses implémentations en mémoire par
défaut. Le bus de commandes du module du noyau exécute chaque commande dans l'`UnitOfWork`
liée ; les gestionnaires ne le savent pas. `contextModule` de `@ddd-ts-kit/di` transforme les
classes déclarées d'un contexte en son module. Les registres sont construits ici et non par
`toClass`, parce qu'il faut dire à chacun comment atteindre son modèle. Le registre de l'outbox
reçoit l'unité de travail elle-même, pas seulement le contexte : sa réclamation `skip-locked`
ouvre sa propre transaction courte.

Un projet écrit par la CLI tient le même câblage en deux fichiers :
`platform/database/persistence-over.ts` construit une fois l'unité de travail et les deux
registres, et `platform/composition/platform.module.ts` les lie, le *publisher* de l'outbox étant donné à
`kernelModule({ eventPublisher })`.

`unitOfWork.run(work)` ouvre la `prisma.$transaction` interactive et garde le client de
transaction dans un `AsyncLocalStorage` ; un `run` imbriqué rejoint la transaction englobante.
`delegate` est une fonction du client, parce que le modèle doit être lu sur le client de
transaction dans une unité de travail et sur le client racine en dehors. Comme `append` utilise
le client courant, un événement publié par un gestionnaire qui échoue ensuite est annulé avec
l'écriture métier : c'est tout l'intérêt de l'outbox.

![Une commande dans une unité de travail Prisma : le bus de commandes appelle run, qui ouvre la transaction Prisma et garde son client dans un AsyncLocalStorage ; le gestionnaire enregistre la facture et ajoute ses événements sur ce client ; quand le travail rend la main, les événements du domaine vont à leurs gestionnaires before-commit, puis la transaction est validée, puis les gestionnaires after-commit s'exécutent ; un échec avant la validation ne laisse aucune ligne et aucun enregistrement d'outbox](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/prisma-unit-of-work-timeline.fr.svg)

Les deux mêmes appels, avec le *publisher* lié au *broker* ou à l'outbox, ne donnent pas la
même garantie :

<!-- checked sample -->
```ts
import { EventBus, IntegrationEventPublisher, UnitOfWork, type IntegrationEvent } from '@ddd-ts-kit/kernel';

interface Invoice {
  issue(): void;
}

interface Invoices {
  save(invoice: Invoice): Promise<void>;
}

declare const unitOfWork: UnitOfWork;
declare const invoices: Invoices;

// Au lieu de : le broker appelé depuis le travail. Le message part avant la validation : si la
// validation échoue ensuite, les consommateurs agissent sur une facture jamais émise, et aucune
// annulation ne reprend le message.
export async function issueAndSend(invoice: Invoice, issued: IntegrationEvent, broker: EventBus): Promise<void> {
  await unitOfWork.run(async () => {
    invoice.issue();
    await invoices.save(invoice);
    await broker.publish([issued]);
  });
}

// Écrire : le publisher lié à l'outbox (OutboxPublisher sur PrismaOutboxStore).
// L'enregistrement est une ligne de la même transaction : il est validé avec la facture ou
// disparaît avec elle, et le relais le publie une fois validé.
export async function issue(invoice: Invoice, issued: IntegrationEvent, publisher: IntegrationEventPublisher): Promise<void> {
  await unitOfWork.run(async () => {
    invoice.issue();
    await invoices.save(invoice);
    await publisher.publish([issued]);
  });
}
```

Un gestionnaire de commande n'appelle pas `run` lui-même : le bus de commandes s'en charge, et
un gestionnaire d'événement d'intégration déclaré s'exécute lui aussi dans une unité de travail.
Un script, ou un consommateur câblé à la main, l'appelle comme ci-dessus.

`createPrismaUnitOfWork(prisma, { timeout: 15_000, isolationLevel: 'RepeatableRead' })`
transmet les options de `$transaction`.

`run` est construit sur `withinUnitOfWork` du noyau. Les événements du domaine des agrégats
enregistrés à l'intérieur attendent que `work` ait rendu la main, puis sont distribués dans la
transaction, avant la validation : leurs gestionnaires voient chaque enregistrement, et ce
qu'ils écrivent est validé ou annulé avec lui. Si `work`, un gestionnaire ou la validation
échoue, rien ne reste : aucune ligne, aucun enregistrement d'outbox, aucun gestionnaire exécuté
après la validation. Les gestionnaires déclarés `after-commit` s'exécutent une fois la
transaction validée. Un `run` imbriqué rejoint l'unité de travail en cours : une seule
distribution, à la fin du plus externe. Un `run` appelé directement (un consommateur, un
script) a le même déroulement qu'une commande.
`unitOfWorkContract` de `@ddd-ts-kit/testing/contracts` le prouve, avec une contrainte différée
pour la validation qui échoue ; sur un vrai PostgreSQL (`DDD_TS_KIT_TEST_DATABASE_URL`), il
prouve aussi que les lignes d'un gestionnaire `before-commit` sont invisibles depuis une autre
connexion et visibles des gestionnaires `after-commit`.
Les gestionnaires `before-commit` s'exécutent dans le temps que Prisma accorde à la transaction
(`timeout`).

## Repository

Le port vit dans le domaine, l'adaptateur dans l'infrastructure. Un *repository* reçoit la base
de données, jamais une transaction : `client()` est le client de transaction de l'unité de
travail quand il y en a une, et le client racine sinon.

```ts
// Au lieu de : la transaction dans le port, ce qui met Prisma dans le domaine et oblige chaque
// appelant à porter une transaction qu'il doit obtenir de quelque part.
abstract save(invoice: Invoice, transaction: Prisma.TransactionClient): Promise<void>;

// Écrire : un port du domaine qui ne sait rien du stockage ; l'adaptateur demande le client.
abstract save(invoice: Invoice): Promise<void>;
```

```ts
// contexts/billing-core/domain/repositories/invoice.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';

export abstract class InvoiceRepository extends Repository<Invoice> {}
```

<!-- checked sample -->
```ts
// contexts/billing-core/infrastructure/persistence/prisma-invoice.repository.ts
import type { AggregateRoot } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { optimisticUpdate, PrismaContext } from '@ddd-ts-kit/prisma';

@Repository(InvoiceRepository)
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly database: Database) {}

  async findById(id: string): Promise<Invoice | undefined> {
    // Dans une unité de travail : le client de transaction. En dehors : le client racine.
    const row = await this.database.client().invoice.findUnique({ where: { id } });

    if (row === null) {
      return undefined;
    }

    const invoice = InvoiceMapper.toDomain(row);
    invoice.version = row.version;

    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    const invoices = this.database.client().invoice;

    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const row = { ...invoice.state, version: next };
      const written =
        expected === 0
          ? await invoices.createMany({ data: [row], skipDuplicates: true })
          : await invoices.updateMany({ where: { id: invoice.id, version: expected }, data: row });

      return written.count;
    });
  }
}

// Ce que le projet a ailleurs, déclaré pour que cet exemple compile seul : le domaine, le
// mapper, la Database de la plateforme et la partie du client généré utilisée ici.
interface InvoiceState {
  readonly id: string;
  readonly amount: number;
  readonly status: string;
}
interface InvoiceRow extends InvoiceState {
  readonly version: number;
}
declare abstract class Invoice extends AggregateRoot {
  get state(): InvoiceState;
}
declare abstract class InvoiceRepository {
  abstract findById(id: string): Promise<Invoice | undefined>;
  abstract save(invoice: Invoice): Promise<void>;
}
declare const InvoiceMapper: { toDomain(row: InvoiceRow): Invoice };
interface TransactionClient {
  readonly invoice: {
    findUnique(args: { where: { id: string } }): Promise<InvoiceRow | null>;
    createMany(args: { data: InvoiceRow[]; skipDuplicates: boolean }): Promise<{ count: number }>;
    updateMany(args: { where: { id: string; version: number }; data: InvoiceRow }): Promise<{ count: number }>;
  };
}
declare abstract class Database extends PrismaContext<TransactionClient> {}
```

Dans le style explicite, sans le décorateur, la même liaison tient en une ligne de
`<context>.module.ts` :
`builder.bind(InvoiceRepository).toClass(PrismaInvoiceRepository, [Database])`.

`Prisma.TransactionClient` est le type de `client()` pour un client simple. Un client étendu
(`prisma.$extends(...)`) a son propre type de client de transaction, que Prisma ne rend pas
assignable à celui-ci : déclarez plutôt `Database` comme
`PrismaContext<PrismaTransactionClient<typeof prisma>>`.

`optimisticUpdate` donne la version à attendre et la version à écrire, lève une
`ConcurrencyError` (une `DomainError` de code `CONCURRENCY_CONFLICT`) quand l'instruction gardée
n'a écrit aucune ligne, et fait avancer `invoice.version` sinon. Utilisez `createMany` et
`updateMany` pour l'écriture gardée : ils renvoient un nombre de lignes, là où `create` et
`update` lèvent une exception, et une violation d'unicité levée interrompt la transaction
PostgreSQL englobante. `upsert` ne peut pas porter la garde de version.

![Deux transactions chargent la facture inv-1 en version 3 ; A enregistre d'abord, sa mise à jour correspond à la version 3 et la ligne passe en version 4 ; B enregistre ensuite, sa mise à jour attend toujours la version 3, ne correspond à aucune ligne, et optimisticUpdate lève une ConcurrencyError de code CONCURRENCY_CONFLICT ; la transaction de B est annulée](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/persistence-optimistic-concurrency.fr.svg)

Une `ConcurrencyError` est une issue attendue, pas un bogue : la commande peut être rejouée sur
un chargement frais, ou l'appelant prévenu que quelqu'un d'autre a modifié la facture.

<!-- checked sample -->
```ts
import { CONCURRENCY_CONFLICT, ConcurrencyError, optimisticUpdate } from '@ddd-ts-kit/prisma';

interface Invoice {
  readonly id: string;
  version: number;
}

declare function updateWhereVersion(invoice: Invoice, expected: number, next: number): Promise<{ count: number }>;

export async function saveOrReport(invoice: Invoice): Promise<'saved' | 'changed meanwhile'> {
  try {
    // Chargée en version 3 : UPDATE ... WHERE id = $1 AND version = 3, qui écrit la version 4.
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const written = await updateWhereVersion(invoice, expected, next);

      return written.count;
    });

    return 'saved'; // invoice.version vaut maintenant 4
  } catch (error) {
    if (error instanceof ConcurrencyError && error.code === CONCURRENCY_CONFLICT) {
      return 'changed meanwhile'; // aucune ligne en version 3 ; invoice.version vaut toujours 3
    }

    throw error;
  }
}
```

## Colonnes d'audit, cloisonnement par tenant et pages

Les formes de persistance standard du noyau, sur Prisma. Un schéma Prisma n'a aucun moyen de
partager des champs entre modèles : il n'y a donc rien à importer ici, copiez les cinq champs.
Gardez leurs noms, qui sont ceux de `AuditStamp` et de `TenantScoped` du noyau, pour qu'un
tampon se déploie tel quel dans `data` ; et gardez les noms de colonnes associés (`created_at`,
`created_by`, `updated_at`, `updated_by`, `tenant_id`), les mêmes dans chaque projet : c'est ce
qui permet d'écrire une seule fois un tableau de bord, un export ou le *package* d'audit.

```prisma
model Invoice {
  id        String   @id
  amount    Int
  status    String
  version   Int
  tenantId  String   @map("tenant_id")
  createdAt DateTime @map("created_at") @db.Timestamptz(3)
  createdBy String   @map("created_by")
  updatedAt DateTime @map("updated_at") @db.Timestamptz(3)
  updatedBy String   @map("updated_by")

  @@index([tenantId, amount, id], map: "invoices_tenant_amount_idx")
  @@map("invoices")
  @@schema("billing_core")
}
```

Ni `@default(now())` ni `@updatedAt` sur ces champs : l'instant est celui de la `Clock`, et les
attributs de Prisma ne savent rien de qui agit.

Le tenant atteint chaque instruction par trois aides, qui le lisent dans la portée d'exécution et
refusent un travail qui n'en nomme aucun (`NoCurrentTenantError`) : `tenantWhere(scope)` se
décompose dans le `where` d'une lecture (le tenant du travail, ou les tenants qu'atteint une
élévation du personnel de la plateforme, `{ tenantId: { in } }` ou rien au-dessus de tous les
tenants), `ownTenantWhere(scope)` dans le `where` d'une mise à jour ou d'une suppression (le seul
tenant du travail, quoi qu'une élévation élargisse) et `tenantScopeOf(scope)` du noyau dans les
`data` d'une création. `findUnique`, `update` et `delete` par clé ne servent pas : le tenant ne
fait jamais partie de la clé. La règle `tenancy/scoped-statement` de la CLI y tient les adaptateurs
d'un projet `--tenancy shared-table`, et `generate repository` les écrit ainsi.

```ts
import { Clock, ExecutionScope, stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { optimisticUpdate, ownTenantWhere, tenantWhere } from '@ddd-ts-kit/prisma';

@Repository(InvoiceRepository)
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    // findFirst, pas findUnique : le tenant fait partie de chaque condition, et il ne fait pas partie de la clé.
    const row = await this.database.client().invoice.findFirst({ where: { id, ...tenantWhere(this.scope) } });

    return row === null ? undefined : InvoiceMapper.toDomain(row);
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { ...InvoiceMapper.toRow(invoice), version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.count;
    });
  }

  private insert(state: VersionedInvoice): Promise<Prisma.BatchPayload> {
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };

    return this.database.client().invoice.createMany({ data: [row], skipDuplicates: true });
  }

  private update(state: VersionedInvoice, expected: number): Promise<Prisma.BatchPayload> {
    return this.database.client().invoice.updateMany({
      where: { id: state.id, version: expected, ...ownTenantWhere(this.scope) },
      data: { ...state, ...stampUpdate(this.scope, this.clock) },
    });
  }
}
```

Une requête de recherche prend la `PageRequest` du noyau et répond une `Page`, dans les deux
variantes :

```ts
// contexts/billing-core/application/ports/invoice-queries.port.ts
export abstract class InvoiceQueries {
  abstract search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>>;
}
```

```ts
// contexts/billing-core/infrastructure/persistence/prisma-invoice-queries.reader.ts
import { ExecutionScope, encodeCursor, pageOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { tenantWhere, type TenantWhere } from '@ddd-ts-kit/prisma';

@Repository(InvoiceQueries)
export class PrismaInvoiceQueries implements InvoiceQueries {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
  ) {}

  async search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.byOffset(request) : this.byCursor(request);
  }

  private async byOffset(request: OffsetPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const where = tenantWhere(this.scope);
    const rows = await this.database.client().invoice.findMany({
      where,
      orderBy: totalOrder(directionOf(request)),
      take: request.limit,
      skip: request.offset,
    });

    return pageOf(rows.map(toSummary), { total: await this.database.client().invoice.count({ where }) });
  }

  private async byCursor(request: CursorPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const tenant = tenantWhere(this.scope);
    const rows = await this.database.client().invoice.findMany({
      where: request.cursor === undefined ? tenant : beyond(positionOf(request.cursor), direction, tenant),
      orderBy: totalOrder(direction),
      take: request.limit + 1,
    });
    const items = rows.slice(0, request.limit);
    const last = items.at(-1);
    const more = rows.length > request.limit && last !== undefined;

    return pageOf(items.map(toSummary), more ? { nextCursor: encodeCursor({ amount: last.amount, id: last.id }) } : {});
  }
}

const directionOf = (request: PageRequest<'amount'>) => request.sort[0]?.direction ?? 'asc';

// La clé primaire suit le champ de tri, dans le même sens : l'ordre est total.
const totalOrder = (direction: SortDirection): Prisma.InvoiceOrderByWithRelationInput[] => [
  { amount: direction },
  { id: direction },
];

// Les lignes après une position, en comparaison de tuples : le départage tranche entre égaux.
function beyond(
  { amount, id }: { amount: number; id: string },
  direction: SortDirection,
  tenant: TenantWhere,
): Prisma.InvoiceWhereInput {
  const past = direction === 'asc' ? 'gt' : 'lt';

  return { ...tenant, OR: [{ amount: { [past]: amount } }, { amount, id: { [past]: id } }] };
}
```

`positionOf(cursor)` décode avec `decodeCursor` et vérifie que `amount` est un nombre et `id`
une chaîne, en levant `InvalidPageRequestError` sinon. L'option `cursor` de Prisma n'est pas
utilisée : elle désigne une ligne par un champ unique, là où une position compare des valeurs
et n'a besoin d'aucune ligne qui existe encore.

Un adaptateur de lecture sur la base de données se déclare avec `@Repository`, comme ceux que
génère la CLI : sa sorte est `repository`. Déclaré avec `@Adapter`, il serait `external`, et une
plateforme générée entoure chaque adaptateur `external` et `gateway` d'une nouvelle tentative
(retry) et d'une limite de temps, ce qu'une instruction de l'unité de travail ne doit pas
recevoir.

Les règles que tiennent ces exemples, et que les tests de ce *package* vérifient sur une vraie
base de données :

- **Les colonnes d'audit** sont remplies par l'adaptateur, jamais par l'agrégat :
  `stampCreation(scope, clock)` à l'insertion, `stampUpdate(scope, clock)` à la mise à jour, qui
  laisse `created_at` et `created_by` intacts. L'acteur est celui de la portée d'exécution :
  l'utilisateur de la requête HTTP, ou `system:<consumer>` pour un événement consommé.
- **Le tenant fait partie de chaque instruction** : écrit à l'insertion (`tenantScopeOf`), et dans
  la condition de chaque lecture (`tenantWhere`) et de chaque mise à jour (`ownTenantWhere`), garde
  de version comprise. Une ligne d'un autre tenant n'est pas trouvée, et une mise à jour qui la
  vise n'écrit rien, ce qu'`optimisticUpdate` signale par une `ConcurrencyError`. Une élévation du
  personnel de la plateforme élargit ce qu'une lecture atteint, jamais ce qu'une écriture touche.
  Un travail qui ne nomme aucun tenant lève `NoCurrentTenantError` avant toute requête SQL. Le
  contrat d'isolation des tenants de `@ddd-ts-kit/testing` le prouve sur ce *repository*.
- **Une liste a un ordre total.** La clé primaire suit le champ de tri, dans le même sens, pour
  départager : sinon, les lignes égales sur le champ de tri n'ont pas d'ordre défini, et une page
  pourrait en répéter ou en sauter une. L'index couvre `(tenant_id, <sort field>, id)`.
- **Un curseur est une position, pas un numéro de page** : la valeur de tri et l'id de la
  dernière ligne, écrits par `encodeCursor`, comparés comme un tuple (`amount > :amount OR
  (amount = :amount AND id > :id)`). Une ligne de plus que `limit` est lue pour savoir si une
  page suit : aucun comptage n'est nécessaire, et une ligne insérée avant le curseur ne décale
  pas la page suivante comme elle le fait avec un *offset*. Un curseur revient d'un client :
  `decodeCursor` refuse ce qu'il n'a pas écrit, et l'adaptateur vérifie les types de la position
  avant qu'ils n'atteignent une instruction.
- **Une page par *offset* répond `total`**, une page par curseur `nextCursor`. Proposez la forme
  par *offset* pour les petites listes que l'on parcourt, et la forme par curseur pour tout ce
  qui grossit.

## Critères

`criteriaToPrisma(plan, fields?)` transforme un plan de critères du noyau en arguments d'un
`findMany` : `where` (les filtres, le périmètre de l'acteur et la position d'une page par
curseur), `counted` (les filtres et le périmètre seuls, pour un `count`), `orderBy` (l'ordre
total terminé par le départage), `take` et `skip`. `predicateToPrisma(predicate, fields?)` donne
un seul `where`. Ce sont des données, jamais du texte : Prisma lie chaque valeur. Les champs du
modèle de lecture sont les champs du modèle ; `fields` renomme ceux qui diffèrent. Le texte de
`contains` et de `startsWith` a ses `%`, `_` et `\` échappés, ce que Prisma ne fait pas.

```ts
// infrastructure/persistence/prisma-appointment-queries.reader.ts
async search(criteria: ScopedCriteria<AppointmentRow>): Promise<Page<AppointmentRow>> {
  const plan = planCriteria(appointmentCriteria, criteria);

  if (plan.empty) {
    return pageOfPlan(plan, []);
  }

  const { where, orderBy, take, skip } = criteriaToPrisma(plan);

  return pageOfPlan(plan, await this.database.client().appointmentRow.findMany({ where, orderBy, take, skip }));
}
```

Une page par curseur est lue avec une ligne de plus que demandé : c'est ainsi que `pageOfPlan`
sait si une autre suit ; une page par *offset* prend son total de `count({ where: counted })`.
Un champ déclaré `nullable` est trié par `{ sort, nulls }` : en dernier en ordre croissant, en
premier en ordre décroissant.

Ce que reçoit Prisma pour la deuxième page des rendez-vous réservés, après une première page qui
s'est terminée sur le rendez-vous `a2` à 10 h :

<!-- checked sample -->
```ts
import { Criteria, cursorPage, defineCriteria, planCriteria } from '@ddd-ts-kit/kernel';
import { criteriaToPrisma } from '@ddd-ts-kit/prisma';

interface AppointmentRow {
  readonly id: string;
  readonly status: string;
  readonly startsAt: Date;
}

const appointmentCriteria = defineCriteria<AppointmentRow>({
  fields: {
    id: { type: 'string' },
    status: { type: 'string', filter: ['eq', 'in'], sortable: true },
    startsAt: { type: 'instant', filter: ['gte', 'lt', 'between'], sortable: true },
  },
  defaultSort: [{ field: 'startsAt', direction: 'asc' }],
  tieBreaker: 'id',
});

// Le nextCursor de la première page : la position { startsAt: '2026-10-13T10:00:00.000Z', id: 'a2' }.
declare const nextCursor: string;

const plan = planCriteria(
  appointmentCriteria,
  Criteria.of<AppointmentRow>().where('status', 'eq', 'booked').page(cursorPage({ limit: 20, cursor: nextCursor })),
);

export const { where, counted, orderBy, take, skip } = criteriaToPrisma(plan);
// where:   { AND: [
//            { status: { equals: 'booked' } },
//            { OR: [
//              { startsAt: { gt: new Date('2026-10-13T10:00:00.000Z') } },
//              { AND: [{ startsAt: { equals: new Date('2026-10-13T10:00:00.000Z') } }, { id: { gt: 'a2' } }] },
//            ] },
//          ] }
// counted: { status: { equals: 'booked' } }, ce que compterait une page par offset
// orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], le départage en dernier : un ordre total
// take:    21, une ligne de plus que la page, pour savoir si une autre suit
// skip:    0
```

**Chaînes.** Une colonne de texte est triée et comparée par plage selon la collation de la
colonne ; les critères trient les chaînes par point de code. Déclarez avec `COLLATE "C"` les
colonnes de texte triées ou comparées avec `gt`, `lt` ou `between`, dans la migration puisque le
schéma Prisma ne sait pas l'exprimer (`ALTER TABLE ... ALTER COLUMN room TYPE text COLLATE "C"`) :
l'index sert alors le tri, et l'ordre est le même que dans le *fake*. **Les décimaux** sont un
champ `Decimal` et une chaîne dans la ligne : le registre les relit en chiffres simples, sans
zéros finaux ni exposant. **Les instants** sont des `timestamptz` et une `Date`. Un champ
`BigInt` se relit en nombre.

## Modèles de lecture

Le modèle d'un modèle de lecture est le vôtre ; `prisma/read-model.postgresql.prisma` de ce
*package* en est le *template*, avec les quatre champs qui ordonnent les événements d'une
projection.

```prisma
model AppointmentRow {
  id               String   @id
  status           String
  startsAt         DateTime @map("starts_at") @db.Timestamptz(3)
  lastEventId      String   @map("last_event_id")
  lastEventAt      DateTime @map("last_event_at") @db.Timestamptz(3)
  lastEventVersion BigInt?  @map("last_event_version")
  deleted          Boolean  @default(false)

  @@map("appointment_list")
  @@schema("scheduling")
}
```

```ts
// infrastructure/persistence/prisma-appointment-list.repository.ts
@Repository(AppointmentList)
export class PrismaAppointmentList extends PrismaReadModelStore<AppointmentRow, Prisma.TransactionClient> implements AppointmentList {
  constructor(database: Database) {
    super(database, {
      delegate: (client) => client.appointmentRow,
      schema: 'scheduling',
      table: 'appointment_list',
      columns: { id: 'id', status: 'status', startsAt: 'starts_at' },
      definition: appointmentCriteria,
    });
  }
}
```

Chaque écriture passe par `TableReadModelStore` du noyau : une ligne n'est écrite que si son
événement est plus récent que celui qu'elle porte, sur l'exécuteur de l'unité de travail, si
bien que la ligne et la marque d'événement traité sont validées ensemble. Une ligne retirée
reste dans la table avec `deleted` positionné : une requête à vous sur la table écarte ces
lignes, tout comme un index unique (`WHERE NOT deleted`). `store.table` est ce que prend
`ProjectionRebuild` ; la reconstruction est réservée à PostgreSQL (une copie `<table>__rebuild`
faite `LIKE ... INCLUDING ALL`, les clés écrites entre-temps dans `<table>__touched`, l'échange
par renommage en une transaction) et ses garanties et limites sont dans le README de
`@ddd-ts-kit/kernel` (« Rebuild »). Le registre passe `criteriaContract` et
`readModelStoreContract` de `@ddd-ts-kit/testing/contracts`, sur PGlite et sur PostgreSQL 18.
Les critères et les modèles de lecture n'ont jamais été exécutés sur MySQL ni sur SQLite.

La table est atteinte par son modèle, et la copie d'une reconstruction, qui n'a pas de modèle,
par `$queryRawUnsafe` avec des identifiants entre guillemets et des paramètres `$n` : c'est
pourquoi la table, le schéma et la colonne de chaque champ sont nommés. Les arguments donnés au
modèle sont construits à l'exécution à partir des champs de la ligne : `PrismaReadModelDelegate`
les type donc comme des objets, et c'est le client généré qui les valide.

Un modèle de lecture de données de *tenant* prend `tenant: { scope }` (et `field` quand le modèle
porte le *tenant* ailleurs que dans `tenantId`, associé à sa colonne par `columns` ou à
`tenant_id`) : chaque ligne s'écrit avec le *tenant* du travail en cours, chaque lecture, recherche
et écriture lui est confinée, une élévation du personnel de la plateforme n'élargissant que les
lectures, et la copie d'une reconstruction suit les mêmes conditions. Les clés restent uniques
entre les *tenants*, puisque le conflit d'une insertion porte sur la seule clé : une clé que deux
*tenants* pourraient partager (un jour, un *slug*) porte le *tenant* (`acme:2026-03-01`). Un
registre construit sans `tenant` dans un projet `--tenancy shared-table` est signalé par
`tenancy/scoped-statement`.

## Effacement des données personnelles

L'effacement d'une personne concernée des tables d'un contexte, à partir des déclarations
`personalFields` écrites à côté de ses *mappers* (`@ddd-ts-kit/kernel`, « Données personnelles ») :
`PrismaPersonalDataErasure` implémente le port `PersonalDataErasure` sur le client de l'unité de travail (`$queryRawUnsafe` et `$executeRawUnsafe`). Le port du contexte étend celui du
kernel, et son adaptateur étend cette classe.

```ts
// infrastructure/persistence/person.personal-fields.ts : la table telle que @@map et @@schema la nomment, les colonnes par leurs noms SQL (@map)
export const personPersonalFields = personalFields<PersonRow, PrismaPersonalTable>(
  { schema: 'identity', table: 'persons' },
  { subject: 'id', fields: ['display_name', 'email'], erasure: 'row' },
);

// infrastructure/persistence/prisma-identity-erasure.repository.ts
@Repository(IdentityErasure)
export class PrismaIdentityErasure extends PrismaPersonalDataErasure<Prisma.TransactionClient> implements IdentityErasure {
  constructor(database: Database, scope: ExecutionScope, files: FileStorage) {
    super(database, { name: 'identity.persons', declarations: [personPersonalFields], tenant: { scope }, files });
  }
}
```

`erase(subject)` supprime d'abord du stockage les fichiers que les lignes nomment, puis supprime les
lignes de la personne (`row`) ou les pseudonymise (`pseudonymise` : une colonne texte lit `[erased]`,
une colonne de tout autre type ne lit rien, une colonne de fichier rien), et répond combien de lignes
il a atteintes, aucune la seconde fois. Avec `tenant`, chaque instruction est confinée au *tenant* du
travail et jamais élargie par une élévation (`tenant_id`, ou `tenant.column`) ; sans lui, la table tient les lignes de tous
les *tenants*. Un sujet qui n'est pas un identifiant opaque est refusé avant toute instruction, et une
déclaration qui nomme des colonnes de fichier sans stockage de fichiers est refusée à la construction
de l'adaptateur. Prisma ne construit aucune instruction sur une colonne qu'il ne connaît pas à la compilation, donc les instructions sont écrites ici pour PostgreSQL, avec des identifiants entre guillemets venus des déclarations et chaque valeur en paramètre `$n` ; les types des colonnes sont lus une fois dans `information_schema`, pour qu'un texte et un nombre soient pseudonymisés chacun à sa façon. Une colonne personnelle qui n'est pas un texte doit accepter null, sinon
les lignes s'effacent avec `row` : une déclaration qui en pseudonymiserait une qui ne l'accepte pas
est refusée avant qu'un fichier ou une ligne ne soit touché (`NotNullablePersonalColumnError`). L'adaptateur passe `personalDataErasureContract` de
`@ddd-ts-kit/testing`, comme celui en mémoire, sur PGlite et PostgreSQL. Ce qu'un effacement
n'atteint pas, et la chaîne entière (`eraseDataSubject` : la clé, chaque copie dans chaque *tenant*,
les reconstructions), sont dans le README du kernel (« Données personnelles »).

`PrismaPersonalDataExport` répond au droit d'accès et à la portabilité à partir des mêmes déclarations :
`exportOf(subject)` remet un `PersonalDataRecord` par ligne sur la personne dans chaque table déclarée,
sous `<name>.<table>`, avec chaque colonne personnelle et chaque colonne de fichier (par sa clé) en
données simples, par leurs noms SQL, aucune autre colonne et rien de personne d'autre ; une ligne déjà
pseudonymisée répond ce qu'elle lit. La même option `tenant` confine chaque instruction au *tenant* du
travail, un sujet qui n'est pas un identifiant opaque est refusé avant toute instruction, et
l'adaptateur passe `personalDataExportContract`. Le port du contexte étend `PersonalDataExport` du
kernel et son adaptateur étend cette classe avec `name`, `declarations` et `tenant`
(`PrismaPersonalDataExportOptions`) ; `generate repository --personal` écrit les deux adaptateurs, et
`exportDataSubject` du kernel rassemble chaque export en un document daté. Enveloppez l'adaptateur
avec `auditedPersonalDataExport` de `@ddd-ts-kit/audit` là où il est lié, pour que chaque remise
laisse une entrée.

Les mêmes déclarations donnent la limitation de la conservation (RGPD, article 5(1)(e)) : une
déclaration avec `retention: { after: 'ended_at', months: 36 }` dit combien de temps ses lignes gardent
la personne, compté depuis une colonne de date de la ligne, et `purgeExpired(now)` de l'adaptateur
d'effacement efface, comme la déclaration le dit, les lignes dont la date est plus ancienne que la
période ; une ligne dont la date est vide n'expire jamais, et un second passage n'atteint rien. Il
se confine au *tenant* du travail quand le travail en nomme un, et atteint chaque *tenant* quand il
n'en nomme aucun, comme le fait le *job* de nuit de la plateforme : un *tenant* oublié dans une liste
garderait ce qu'il ne doit pas. L'adaptateur implémente `PersonalDataRetention` du kernel et passe
`personalDataRetentionContract` ; `purgeExpiredPersonalData` du kernel lance chaque copie, et
`auditedPersonalDataRetention` de `@ddd-ts-kit/audit` enregistre chaque purge.

## Outbox et idempotence

`claim` est requis, parce qu'un client Prisma ne dit pas à quelle base de données il parle :

- `{ strategy: 'skip-locked', dialect, raw, schema?, table? }` sélectionne les lignes dues
  `FOR UPDATE SKIP LOCKED` et leur donne un bail dans la même transaction courte en repoussant
  `nextAttemptAt` (`leaseMs`, 30 s par défaut) : plusieurs relais se partagent le travail sans
  s'attendre, et les enregistrements d'un relais mort reviennent quand le bail expire. Demande
  PostgreSQL ou MySQL 8. Prisma Client n'a pas d'API de verrouillage de ligne : ce seul select
  est donc du SQL brut envoyé avec `$queryRawUnsafe` (`raw: (client) => client` remet cette
  méthode au registre) ; `schema` et `table` sont les vrais noms de la table et doivent être des
  identifiants simples. Tout le reste, la mise à jour comprise, passe par Prisma Client.
- `'compare-and-set'` lit les lignes dues et prend chacune par un `updateMany` gardé par le
  nombre de tentatives lu : même garantie, pas de SQL brut, toute base de données, une
  instruction par enregistrement.
- `tenant: true` écrit le *tenant* de chaque événement dans `tenantId`, le champ qu'un projet
  multi-tenant décommente dans le fragment livré (`tenantId String? @map("tenant_id")`, nullable :
  un événement sans *tenant*, et les événements publiés avant que le champ existe) : ses
  consommateurs s'exécutent alors dans ce *tenant*. Un modèle qui porte le champ est relu dans tous
  les cas.

![Les deux stratégies de réclamation côte à côte : skip-locked verrouille les lignes dues par un select for update skip locked en SQL brut, les lit et leur donne un bail en une transaction courte, si bien que les relais sautent les lignes des autres ; compare-and-set lit les lignes dues, prend chacune par un updateMany gardé par le nombre de tentatives lu, et relit pour remplacer les lignes qu'un autre relais a prises ; dans les deux cas un enregistrement réclamé est caché pendant leaseMs, si bien que les enregistrements d'un relais mort sont réclamés de nouveau](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/prisma-outbox-claim.fr.svg)

<!-- checked sample -->
```ts
// platform/database/outbox.ts
import {
  createPrismaUnitOfWork,
  PrismaOutboxStore,
  PrismaProcessedEventStore,
  type PrismaOutboxDelegate,
  type PrismaProcessedEventDelegate,
  type PrismaRawQueries,
} from '@ddd-ts-kit/prisma';

// Tient lieu du client qu'écrit `prisma generate`, réduit à ce qu'appellent les registres : les
// modèles du fragment livré, renommés ici MessagingOutboxRecord et MessagingProcessedEvent.
interface TransactionClient extends PrismaRawQueries {
  readonly messagingOutboxRecord: PrismaOutboxDelegate;
  readonly messagingProcessedEvent: PrismaProcessedEventDelegate;
}
declare const prisma: TransactionClient & {
  $transaction<R>(work: (transaction: TransactionClient) => Promise<R>, options?: { timeout?: number }): Promise<R>;
};

const unitOfWork = createPrismaUnitOfWork(prisma);

// PostgreSQL ou MySQL 8 : un select brut par lot, les relais ne s'attendent jamais.
export const outbox = new PrismaOutboxStore(unitOfWork, {
  delegate: (client) => client.messagingOutboxRecord,
  claim: { strategy: 'skip-locked', dialect: 'postgresql', schema: 'messaging', table: 'outbox', raw: (client) => client },
  leaseMs: 60_000, // plus long que la publication la plus lente d'un lot
});

// Toute base de données, Prisma Client seul : un updateMany par enregistrement réclamé.
export const portableOutbox = new PrismaOutboxStore(unitOfWork, {
  delegate: (client) => client.messagingOutboxRecord,
  claim: 'compare-and-set',
});

export const processedEvents = new PrismaProcessedEventStore(unitOfWork, {
  delegate: (client) => client.messagingProcessedEvent,
});
```

`PrismaProcessedEventStore.markProcessed` est un `createMany({ skipDuplicates: true })`.
Exécutez le consommateur dans l'unité de travail : la marque est alors validée avec les effets
du gestionnaire, et disparaît avec eux s'il échoue. Un `@IntegrationEventHandler` déclaré, ou
`consume` de `@ddd-ts-kit/events`, fait exactement cela ; à la main, cela donne :

<!-- checked sample -->
```ts
import type { IntegrationEvent, ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';

declare const unitOfWork: UnitOfWork;
declare const processedEvents: ProcessedEventStore;
declare function issueInvoiceFor(event: IntegrationEvent): Promise<void>;

const consumer = 'billing.invoice-on-order-placed';

// Au lieu de : agir d'abord, se souvenir ensuite. Un crash entre les deux, ou une nouvelle
// livraison pendant que la première tourne encore, émet la facture deux fois.
export async function onOrderPlacedTwice(event: IntegrationEvent): Promise<void> {
  await issueInvoiceFor(event);
  await processedEvents.markProcessed(consumer, event.id);
}

// Écrire : la marque et les effets dans une seule unité de travail. La marque répond false pour
// un événement déjà traité ; si le gestionnaire échoue, la marque est annulée et la nouvelle
// livraison s'exécute.
export async function onOrderPlaced(event: IntegrationEvent): Promise<void> {
  await unitOfWork.run(async () => {
    if (!(await processedEvents.markProcessed(consumer, event.id))) {
      return;
    }

    await issueInvoiceFor(event);
  });
}
```

La livraison se fait au moins une fois, sans ordre.

## Tâches de fond et instances de processus

Copiez les deux modèles de `prisma/jobs-and-processes.postgresql.prisma` dans le schéma, dans le
schéma du contexte dont ils gardent les tâches (`init --orm prisma --queue database` les écrit
dans `messaging`). Gardez les noms des champs, des tables et des colonnes : la réclamation des
tâches est la seule instruction brute du registre, et elle sélectionne les colonnes par leur nom.

- `PrismaJobStore` est le `JobStore` de `@ddd-ts-kit/scheduling`. `add` écrit sur le client de
  l'unité de travail : une tâche mise en file par une commande existe si et seulement si la
  commande a été validée. Une réclamation sélectionne les lignes dues de la file
  `FOR UPDATE SKIP LOCKED`, puis les bail et les relit dans la même transaction courte : plusieurs
  *workers* passent les uns sur les lignes des autres. Une clé d'idempotence est unique par nom
  de tâche et par tenant ; un doublon est écarté par `createMany({ skipDuplicates: true })`, qui
  laisse la transaction de la commande utilisable. PostgreSQL seulement.
- `PrismaProcessStore` est le `ProcessStore` du noyau : une étape d'un gestionnaire de processus
  enregistre son instance dans la transaction de son unité de travail, un premier enregistrement
  écarte la ligne qu'un premier enregistrement concurrent a écrite, un suivant met à jour la ligne
  à la version précédente, et un enregistrement qui ne change aucune ligne est refusé par
  `ConcurrencyError`. Avec `tenant` (l'`ExecutionScope`), le store garde chaque instance dans le tenant du travail qui
  l'enregistre : la table repère aussi une ligne par son tenant, le texte vide hors de tout tenant,
  si bien que deux tenants peuvent utiliser la même clé de corrélation ; une instance d'un autre
  tenant n'est ni trouvée ni modifiée, et un travail qui ne nomme aucun tenant est refusé par
  `NoCurrentTenantError`.
- Le point de reprise d'une tâche et l'état d'une instance sont du JSON gardé en texte : un
  *worker* efface un point de reprise et un état peut valoir `null`, ce qu'un champ `Json`
  n'accepte que par la sentinelle du client généré (voir [Limites](#limites)).

<!-- checked sample -->
```ts
// platform/database/background-work.ts
import {
  createPrismaUnitOfWork,
  PrismaJobStore,
  PrismaProcessStore,
  type PrismaJobDelegate,
  type PrismaProcessDelegate,
  type PrismaRawQueries,
} from '@ddd-ts-kit/prisma';

// Tient lieu du client qu'écrit `prisma generate`, réduit à ce qu'appellent les registres : les
// modèles du fragment livré, dans le schéma `messaging`.
interface TransactionClient extends PrismaRawQueries {
  readonly backgroundJob: PrismaJobDelegate;
  readonly processInstance: PrismaProcessDelegate;
}
declare const prisma: TransactionClient & {
  $transaction<R>(work: (transaction: TransactionClient) => Promise<R>, options?: { timeout?: number }): Promise<R>;
};

const unitOfWork = createPrismaUnitOfWork(prisma);

// La réclamation est du SQL brut : elle nomme le schéma (et la table, quand ce n'est pas `background_jobs`).
export const jobs = new PrismaJobStore(unitOfWork, { delegate: (client) => client.backgroundJob, schema: 'messaging' });

export const processes = new PrismaProcessStore(unitOfWork, { delegate: (client) => client.processInstance });
```

## Event store

Copiez les modèles de `prisma/event-store.postgresql.prisma` dans le schéma ;
`prisma migrate dev` crée les tables. Gardez leurs noms de tables et de colonnes : les registres
exécutent des instructions brutes dessus.

```ts
const { events, snapshots, checkpoints, subjectKeys } = createPrismaEventSourcing(unitOfWork);
```

Un contexte qui garde son *event store* dans un schéma à lui ajoute `@@schema("<context>")` aux
copies, leur donne des noms de modèles propres, et passe `{ schema: '<context>' }`.

Chaque instruction s'exécute sur l'exécuteur du contexte : un ajout rejoint la transaction de
l'unité de travail, si bien que le flux et les enregistrements d'outbox que publient ses
événements sont validés ensemble (`eventStoreUnitOfWorkContract`). Les ajouts prennent la tête
du registre, une ligne verrouillée jusqu'à la fin de leur transaction : les positions sont données
dans l'ordre de validation, sans trou, et deux ajouts ne s'exécutent jamais côte à côte, quels
que soient leurs flux. PostgreSQL seulement. Les registres sont ceux du noyau
(`PostgresEventStore` et ses compagnons), tenus ici à `eventStoreContract` ; la façon dont un
agrégat en *event sourcing* les utilise : le README de `@ddd-ts-kit/kernel`, section « Event
sourcing ».

## Couverture des dialectes

Ce qui suit concerne ce *package*. La CLI ne génère que pour PostgreSQL : `init --orm prisma`
refuse `--database mysql` et `--database sqlite`.

| Base de données | État |
|---|---|
| PostgreSQL | Couvert par la suite automatisée, via `@prisma/adapter-pg` : suites de contrat de `@ddd-ts-kit/testing`, contrat de *repository*, annulation, unité de travail imbriquée, réclamations concurrentes, les deux stratégies de réclamation de l'outbox, le registre des tâches et celui des processus. Elle s'exécute par défaut sur PGlite servi par le protocole réseau de PostgreSQL, et sur un vrai serveur quand `DDD_TS_KIT_TEST_DATABASE_URL` est définie (dernière exécution : PostgreSQL 18). |
| MySQL 8 | Hors de la suite automatisée. Le fragment est validé par `prisma validate` ; les suites de contrat de l'outbox et des événements traités et l'annulation d'`append` ont été exécutées une fois à la main contre MySQL 8.4 via `@prisma/adapter-mariadb`, avec `skip-locked` et `compare-and-set`. |
| SQLite | Hors de la suite automatisée. Le fragment est validé par `prisma validate` ; la suite de contrat de l'outbox a été exécutée une fois à la main via `@prisma/adapter-better-sqlite3` avec `compare-and-set`, la seule réclamation disponible là. Le registre des événements traités demande le *delegate* montré sous Limites. |
| CockroachDB, SQL Server, MongoDB | Jamais exécuté. |

## Limites

Ce que Prisma ne permet pas, et ce que le *package* en fait :

- **Pas de verrouillage de ligne dans Prisma Client.** `FOR UPDATE SKIP LOCKED` n'existe qu'en
  SQL brut, d'où l'option `skip-locked` qui nomme le dialecte et la table, et l'alternative
  `compare-and-set` qui reste dans Prisma Client.
- **L'imbrication n'est pas portable.** Un client de transaction de Prisma 7 peut ouvrir une
  `$transaction` imbriquée (un *savepoint*), un client de Prisma 6 ne le peut pas. Le *package*
  n'utilise ni l'un ni l'autre : un `run` imbriqué rejoint la transaction englobante, et
  `claimBatch` appelé dans une unité de travail réclame dans cette unité de travail.
- **Les transactions interactives sont bornées dans le temps** : 5 secondes par défaut, puis
  Prisma annule. Passez `timeout` à `createPrismaUnitOfWork` pour les commandes longues. Elles
  tiennent aussi une connexion pendant toute leur durée.
- **Un `null` nu est refusé dans un champ `Json`**, et les sentinelles qui l'expriment vivent
  dans le client généré. Les registres omettent une charge utile `null` : elle est stockée en
  `NULL` SQL et relue en `null` ; le champ est donc `Json?`. Ce qui peut devoir repasser à `null`
  après avoir été écrit, le point de reprise d'une tâche et l'état d'une instance de processus,
  est du JSON dans un champ texte.
- **Pas d'index partiel dans le langage du schéma.** Le fragment déclare un index simple sur
  `(status, nextAttemptAt, sequence)`. Sur PostgreSQL, vous pouvez le remplacer à la main dans la
  migration par `(next_attempt_at, sequence) WHERE status = 'pending'` ; de même l'index de la
  réclamation des tâches par `WHERE status IN ('waiting', 'running')`.
- **Pas de `createMany({ skipDuplicates })` sur SQLite, SQL Server et MongoDB.** Là, le modèle
  ne correspond pas à `PrismaProcessedEventDelegate` ; donnez au registre un *delegate* qui
  traduit la violation d'unicité, que SQLite tolère dans une transaction :

  ```ts
  new PrismaProcessedEventStore(unitOfWork, {
    delegate: (client) => ({
      createMany: async ({ data }) => {
        let count = 0;
        for (const row of data) {
          try {
            await client.processedEvent.create({ data: row });
            count += 1;
          } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
              throw error;
            }
          }
        }
        return { count };
      },
    }),
  });
  ```

- **Le registre ne peut pas voir le fournisseur de base de données** : rien n'est donc choisi
  pour vous, `claim` est requis.
- Testé avec Prisma 7.10 et ses adaptateurs de pilote. La plage *peer* est Prisma 7
  (`@prisma/client` `^7.0.0`).
- `stats()` fait trois requêtes `count`, pas une seule instruction : les nombres d'une outbox
  ou d'une file chargée peuvent ne pas correspondre au même instant.

## Tester un adaptateur

L'unité de travail de ce *package* passe `unitOfWorkContract`, et ses registres
`outboxStoreContract`, `processedEventStoreContract`, `jobStoreContract` et `processStoreContract`, de `@ddd-ts-kit/testing/contracts`.
Tenez vos *repositories* à `repositoryContract` de la même façon, à côté de leur *fake* en
mémoire. Les tests de ce *package* ne demandent ni conteneur ni étape manuelle :

```
npx vitest run packages/prisma
DDD_TS_KIT_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres npx vitest run packages/prisma
```

Les tests ont besoin d'un client généré. Chaque fichier de *spec* attend d'abord
`test/support/generate.ts`, qui construit un schéma à partir du fragment PostgreSQL livré (les
modèles tels quels, plus une copie renommée dans un schéma `messaging` et l'exemple `Invoice`),
lance `prisma generate` et `prisma migrate diff` dans `test/generated/` (ignoré par git), et
saute tout cela quand ce répertoire est à jour. Les suites elles-mêmes vivent dans
`test/suites/` et importent le client généré comme le ferait le code d'une application.

Avec la variable définie, chaque fichier de *spec* crée sa propre base de données sur ce serveur
et la supprime ensuite, et les tests qui ont besoin de deux vraies connexions (un relais qui
saute les lignes verrouillées par un autre) s'exécutent au lieu d'être sautés.
