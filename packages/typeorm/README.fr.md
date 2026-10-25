[English](README.md) · **Français**
<!-- translation-of: README.md sha256:62c82dbb24125131 -->

# @ddd-ts-kit/typeorm

Les adaptateurs TypeORM des ports du noyau et des événements : une unité de travail que les
*repositories* ne voient jamais, le store de l'outbox transactionnelle, le store des événements
traités, les tâches de fond et les instances des gestionnaires de processus, leurs tables sous
forme d'objets `EntitySchema`, et un schéma de base de données par
contexte délimité (bounded context). Les mêmes pièces que `@ddd-ts-kit/drizzle`, pour les
projets sur TypeORM.

```
npm i @ddd-ts-kit/typeorm typeorm pg
```

Tout ici utilise `EntitySchema`, pas des classes décorées : aucun import de `reflect-metadata`,
pas d'`experimentalDecorators`, et les lignes restent des objets simples qu'un *mapper*
transforme en agrégats. PostgreSQL d'abord ; voir
[Couverture des dialectes](#couverture-des-dialectes) pour MySQL et SQLite.

## Sa place dans une application

Rien d'ici n'est importé depuis `domain/` ni `application/`. Un gestionnaire (handler) dépend du
port de *repository* de son domaine ; l'adaptateur de ce port, dans `infrastructure/`, exécute
ses instructions sur le `TypeOrmContext` ; la plateforme construit l'unité de travail une fois et
la lie.

![Un contexte délimité contient un gestionnaire, le port de repository du domaine et le repository TypeORM qui l'implémente ; createTypeOrmUnitOfWork donne un seul objet qui est à la fois le UnitOfWork dans lequel le bus de commandes exécute chaque commande et le TypeOrmContext dont le manager() sert aux requêtes du repository et des stores ; il ouvre dataSource.transaction() sur la DataSource TypeORM, qui écrit dans PostgreSQL les tables du contexte, l'outbox et les événements traités](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/typeorm-place-in-an-application.fr.svg)

L'idée à retenir : **toute instruction passe par `manager()`**. Dans une unité de travail,
c'est l'`EntityManager` transactionnel de cette unité de travail : la ligne de l'agrégat,
l'enregistrement d'outbox de l'événement qu'il a publié et la marque d'événement traité d'un
consommateur sont validés ou annulés ensemble. Hors d'une unité de travail (une requête, un
script), c'est `dataSource.manager`.

## Schéma

Les tables sont des objets `EntitySchema` : ajoutez-les aux `entities` de la source de données
et `typeorm migration:generate` écrit leur DDL dans une migration de votre projet.

```ts
// platform/database/schema.ts
import { outboxEntity, processedEventEntity, schemaNameOf } from '@ddd-ts-kit/typeorm';

export const outbox = outboxEntity({ schema: 'messaging' }); // messaging.outbox
export const processedEvents = processedEventEntity({ schema: 'messaging' });

// contexts/billing-core/infrastructure/persistence/invoice-row.schema.ts
import { EntitySchema } from 'typeorm';

export interface InvoiceRow {
  id: string;
  amount: number;
  status: 'draft' | 'issued';
  version: number;
}

export const invoices = new EntitySchema<InvoiceRow>({
  name: 'Invoice',
  tableName: 'invoices',
  schema: schemaNameOf('billing-core'), // billing_core
  columns: {
    id: { type: 'text', primary: true },
    amount: { type: 'int' },
    status: { type: 'text' },
    version: { type: 'int' },
  },
});
```

Les options des deux fabriques : `schema` (aucune : le schéma par défaut de la connexion),
`dialect` (`postgres` par défaut, `mysql`, `sqlite` : il choisit les types des colonnes JSON et
horodatage), `tableName`, et `name`, le nom de l'entité. Le nom de l'entité vaut par défaut
`OutboxRecord` ou `ProcessedEvent`, suffixé du schéma (`OutboxRecord_messaging`), si bien que
chaque contexte peut enregistrer sa propre outbox dans la même source de données.

`outbox` est indexée pour le relais (les enregistrements en attente par prochaine tentative,
index partiel sur PostgreSQL et SQLite) ; `processed_events` a `(consumer, event_id)` pour clé
primaire. TypeORM ne crée pas les schémas : créez-les dans la migration
(`CREATE SCHEMA IF NOT EXISTS`).

## Racine de composition

`createTypeOrmUnitOfWork(dataSource)` donne un seul objet qui est deux ports : le `UnitOfWork`
du noyau, et `TypeOrmContext`, la poignée sur laquelle les *repositories* et les stores
exécutent leurs requêtes. Liez-le aux deux :

```ts
// platform/database/persistence.module.ts
import { DataSource } from 'typeorm';
import { defineContextModule } from '@ddd-ts-kit/di';
import { IntegrationEventPublisher, ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxStore } from '@ddd-ts-kit/events';
import {
  createTypeOrmUnitOfWork,
  TypeOrmContext,
  TypeOrmOutboxStore,
  TypeOrmProcessedEventStore,
} from '@ddd-ts-kit/typeorm';

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [outbox, processedEvents, invoices],
});

const unitOfWork = createTypeOrmUnitOfWork(dataSource);

export const persistenceModule = defineContextModule({
  name: 'persistence',
  register(builder) {
    builder.rebind(UnitOfWork).toValue(unitOfWork);
    builder.bind(TypeOrmContext).toValue(unitOfWork);
    builder
      .bind(OutboxStore)
      .toFactory((resolve) => new TypeOrmOutboxStore(resolve(TypeOrmContext), { entity: outbox }));
    builder
      .rebind(ProcessedEventStore)
      .toFactory((resolve) => new TypeOrmProcessedEventStore(resolve(TypeOrmContext), { entity: processedEvents }));
    builder.rebind(IntegrationEventPublisher).toClass(OutboxPublisher, [OutboxStore]);
  },
  onStart: async () => {
    await dataSource.initialize();
  },
  onStop: () => dataSource.destroy(),
});
```

```ts
// main.ts
const app = createApplication({ modules: [kernelModule(), persistenceModule, contextModule('billing', billingDeclarations)] });

const relay = new OutboxRelay({ store: app.resolve(OutboxStore), publisher: broker, clock: app.resolve(Clock) });
relay.start({ intervalMs: 500 });
```

Placez le module après `kernelModule()` : `rebind` remplace ses valeurs par défaut en mémoire.
Le bus de commandes du module du noyau exécute chaque commande dans le `UnitOfWork` lié ; les
gestionnaires n'en savent rien. `contextModule` de `@ddd-ts-kit/di` transforme les classes
déclarées d'un contexte en son module.

Un projet écrit par la CLI contient le même câblage en deux fichiers :
`platform/database/persistence-over.ts` construit l'unité de travail et les deux stores une
fois, et `platform/composition/platform.module.ts` les lie, le *publisher* de l'outbox étant passé à
`kernelModule({ eventPublisher })`.

Passez à un store l'entité même que la source de données enregistre. Sans `entity`, un store
utilise `outboxEntity()` ou `processedEventEntity()`, que TypeORM fait correspondre par son nom à
l'entité par défaut dans le schéma par défaut ; la classe se lie alors directement :
`builder.bind(OutboxStore).toClass(TypeOrmOutboxStore, [TypeOrmContext])`,
`builder.rebind(ProcessedEventStore).toClass(TypeOrmProcessedEventStore, [TypeOrmContext])`.

`unitOfWork.run(work)` ouvre `dataSource.transaction` et garde l'`EntityManager` transactionnel
dans un `AsyncLocalStorage` ; un `run` imbriqué rejoint la transaction englobante (sans point de
sauvegarde). Comme `append` utilise le *manager* courant, un événement publié par un
gestionnaire qui échoue ensuite est annulé avec l'écriture métier : c'est toute la raison
d'être de l'outbox. `createTypeOrmUnitOfWork(dataSource, 'REPEATABLE READ')` fixe le niveau
d'isolation.

`run` repose sur `withinUnitOfWork` du noyau. Les événements du domaine des agrégats enregistrés
à l'intérieur attendent que `work` ait rendu la main, puis sont distribués dans la transaction,
avant la validation (commit) : leurs gestionnaires voient chaque enregistrement, et ce qu'ils
écrivent est validé ou annulé avec. Si `work`, un gestionnaire ou la validation échoue, il ne
reste rien : aucune ligne, aucun enregistrement d'outbox, aucun gestionnaire exécuté après la
validation. Les gestionnaires déclarés `after-commit` s'exécutent une fois la transaction
validée. Un `run` imbriqué rejoint l'unité de travail en cours : une seule distribution, à la fin
de la plus externe. Un `run` appelé directement (un consommateur, un script) suit le même
déroulé qu'une commande. `unitOfWorkContract` de `@ddd-ts-kit/testing/contracts` le prouve, avec
une contrainte différée pour la validation qui échoue ; sur un vrai PostgreSQL
(`DDD_TS_KIT_TEST_DATABASE_URL`), il prouve aussi que les lignes d'un gestionnaire
`before-commit` sont invisibles depuis une autre connexion et visibles des gestionnaires
`after-commit`. Le README de `@ddd-ts-kit/kernel` dessine ce déroulé
([Événements du domaine et unité de travail](../kernel/README.fr.md#événements-du-domaine-et-unité-de-travail)).

`TypeOrmContext` est une classe abstraite : elle est donc son propre jeton d'injection. Un projet
à deux sources de données donne à chacune sa propre classe
(`export abstract class Ledger extends TypeOrmContext {}` dans `platform/database/`) et lie
chacune à son unité de travail.

## Repository

Le port vit dans le domaine, l'adaptateur dans l'infrastructure. Un *repository* reçoit le
contexte, jamais une transaction : `manager()` est le *manager* transactionnel de l'unité de
travail s'il y en a une, et `dataSource.manager` sinon.

```ts
// contexts/billing-core/domain/repositories/invoice.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';

export abstract class InvoiceRepository extends Repository<Invoice> {}
```

```ts
// contexts/billing-core/infrastructure/persistence/type-orm-invoice.repository.ts
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { insertIgnoringConflict, optimisticUpdate, TypeOrmContext } from '@ddd-ts-kit/typeorm';

@Repository(InvoiceRepository)
export class TypeOrmInvoiceRepository implements InvoiceRepository {
  constructor(private readonly context: TypeOrmContext) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await this.context.manager().findOneBy(invoices, { id });

    if (row === null) {
      return undefined;
    }

    const invoice = Invoice.rehydrate(row);
    invoice.version = row.version;

    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    const manager = this.context.manager();

    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const row = { ...invoice.state, version: next };

      if (expected === 0) {
        return (await insertIgnoringConflict(manager, invoices, row)) ? 1 : 0;
      }

      const updated = await manager.update(invoices, { id: invoice.id, version: expected }, row);

      return updated.affected ?? 0;
    });
  }
}
```

Dans le style explicite, sans le décorateur, la même liaison tient en une ligne de
`<context>.module.ts` :
`builder.bind(InvoiceRepository).toClass(TypeOrmInvoiceRepository, [TypeOrmContext])`.

`optimisticUpdate` donne la version attendue et la version à écrire, lève une
`ConcurrencyError` (une `DomainError` de code `CONCURRENCY_CONFLICT`) quand l'instruction gardée
n'a écrit aucune ligne, et fait avancer `invoice.version` sinon. `insertIgnoringConflict` insère
sauf si la clé existe et dit s'il l'a fait ; contrairement à une violation d'unicité
interceptée, il laisse utilisable la transaction PostgreSQL qui l'entoure. N'utilisez pas
`manager.save` pour un agrégat : il lit avant d'écrire et choisit seul entre insertion et mise à
jour, ce qui défait la garde de version. Le `@VersionColumn` de TypeORM n'est pas utilisé pour la
même raison : la version appartient à l'agrégat.

```ts
// Au lieu de : une lecture, puis une insertion ou une mise à jour choisie par TypeORM, sans garde de version
await manager.save(invoices, { ...invoice.state, version: invoice.version + 1 });

// Écrivez : l'instruction gardée, qui n'écrit aucune ligne quand une autre transaction a enregistré avant
await optimisticUpdate(invoice, async ({ expected, next }) => {
  // un premier enregistrement (expected 0) insère plutôt avec insertIgnoringConflict, comme dans le repository ci-dessus
  const updated = await manager.update(invoices, { id: invoice.id, version: expected }, { ...invoice.state, version: next });

  return updated.affected ?? 0;
});
```

![optimisticUpdate lit la version à laquelle l'agrégat a été chargé et calcule la suivante ; un premier enregistrement insère avec insertIgnoringConflict, un enregistrement suivant exécute une mise à jour gardée par la version attendue ; une ligne écrite fait avancer la version de l'agrégat, aucune ligne écrite lève ConcurrencyError ; à côté, deux appels concurrents à manager.save réussissent tous les deux et le second efface le premier](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/typeorm-save-an-aggregate.fr.svg)

Ce que fait `optimisticUpdate`, seul, du nombre de lignes que renvoie l'écriture :

<!-- checked sample -->
```ts
import { ConcurrencyError, optimisticUpdate } from '@ddd-ts-kit/typeorm';

// Ce qu'un repository passe à optimisticUpdate : l'agrégat, et une écriture qui répond combien de lignes elle a écrites.
const invoice = { id: 'inv-1', version: 3 }; // lu en version 3

await optimisticUpdate(invoice, async ({ expected, next }) => {
  // expected = 3 : la garde de l'UPDATE (WHERE id = 'inv-1' AND version = 3)
  // next = 4 : la version avec laquelle la ligne est écrite
  return expected === 3 && next === 4 ? 1 : 0;
});
// invoice.version vaut maintenant 4 : le même agrégat peut être enregistré de nouveau

try {
  // Une autre transaction a enregistré inv-1 entre-temps : l'UPDATE gardé ne trouve aucune ligne.
  await optimisticUpdate(invoice, async () => 0);
} catch (error) {
  if (error instanceof ConcurrencyError) {
    console.log(error.code); // CONCURRENCY_CONFLICT ; invoice.version vaut toujours 4
  }
}
```

La commande qui enregistrait échoue avec cette erreur et son unité de travail est annulée : rien
de ce qu'elle a écrit ne reste, et l'appelant relit l'agrégat avant de réessayer.

## Colonnes d'audit, restriction au tenant et pages

Les formes de persistance standard du noyau, sur TypeORM. `auditColumns(dialect?)` et
`tenantColumn()` sont des options de colonnes à étaler dans les `columns` d'un `EntitySchema` :
leurs propriétés sont celles des `AuditStamp` et `TenantScoped` du noyau, si bien qu'un tampon
s'étale tel quel dans une insertion, et les colonnes portent les mêmes noms dans tous les projets
(`created_at`, `created_by`, `updated_at`, `updated_by`, `tenant_id`) : c'est ce qui permet
d'écrire une seule fois un tableau de bord, un export ou le *package* d'audit.

```ts
import type { AuditStamp, TenantScoped } from '@ddd-ts-kit/kernel';
import { auditColumns, schemaNameOf, tenantColumn } from '@ddd-ts-kit/typeorm';

interface InvoiceRow extends VersionedInvoice, TenantScoped, AuditStamp {}

export const invoices = new EntitySchema<InvoiceRow>({
  name: 'Invoice',
  tableName: 'invoices',
  schema: schemaNameOf('billing-core'),
  columns: {
    id: { type: 'text', primary: true },
    amount: { type: 'int' },
    status: { type: 'text' },
    version: { type: 'int' },
    ...tenantColumn(),
    ...auditColumns(),
  },
  indices: [{ name: 'invoices_tenant_amount_idx', columns: ['tenantId', 'amount', 'id'] }],
});
```

Le *tenant* atteint chaque instruction par trois aides, qui le lisent dans la portée d'exécution
et refusent un travail qui n'en nomme aucun (`NoCurrentTenantError`) : `tenantWhere(scope)` se
décompose dans le where d'une lecture, en options de recherche ou sur un *query builder* (le
*tenant* du travail, ou les *tenants* qu'atteint une élévation du personnel de la plateforme,
`In([...])` ou rien au-dessus de tous les *tenants*), `ownTenantWhere(scope)` dans les critères
d'une mise à jour ou d'une suppression (le seul *tenant* du travail, quoi qu'une élévation
élargisse) et `tenantScopeOf(scope)` du noyau dans une ligne insérée. `save` et `upsert` ne
servent pas : ils écrivent par la clé, dont le *tenant* ne fait jamais partie. La règle
`tenancy/scoped-statement` de la CLI y tient les adaptateurs d'un projet `--tenancy shared-table`,
et `generate repository` les écrit ainsi.

```ts
import { Clock, ExecutionScope, stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { insertIgnoringConflict, optimisticUpdate, ownTenantWhere, tenantWhere } from '@ddd-ts-kit/typeorm';

@Repository(InvoiceRepository)
export class TypeOrmInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly context: TypeOrmContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await this.context.manager().findOneBy(invoices, { id, ...tenantWhere(this.scope) });

    return row === null ? undefined : InvoiceMapper.toDomain(row);
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { ...InvoiceMapper.toRow(invoice), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedInvoice): Promise<number> {
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };

    return (await insertIgnoringConflict(this.context.manager(), invoices, row)) ? 1 : 0;
  }

  private async update(state: VersionedInvoice, expected: number): Promise<number> {
    const guarded = { id: state.id, version: expected, ...ownTenantWhere(this.scope) };
    const row = { ...state, ...stampUpdate(this.scope, this.clock) };

    return (await this.context.manager().update(invoices, guarded, row)).affected ?? 0;
  }
}
```

Les `@CreateDateColumn` et `@UpdateDateColumn` de TypeORM ne sont pas utilisés : ils prennent
l'heure du serveur de base de données, pas celle de la `Clock`, et ne savent rien de qui agit.

Une requête de recherche prend la `PageRequest` du noyau et renvoie une `Page`, dans ses deux
variantes :

```ts
// contexts/billing-core/application/ports/invoice-queries.port.ts
export abstract class InvoiceQueries {
  abstract search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>>;
}
```

```ts
// contexts/billing-core/infrastructure/persistence/type-orm-invoice-queries.reader.ts
import { LessThan, MoreThan, type FindOptionsWhere } from 'typeorm';
import { ExecutionScope, encodeCursor, pageOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { tenantWhere, type TenantWhere } from '@ddd-ts-kit/typeorm';

@Repository(InvoiceQueries)
export class TypeOrmInvoiceQueries implements InvoiceQueries {
  constructor(
    private readonly context: TypeOrmContext,
    private readonly scope: ExecutionScope,
  ) {}

  async search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.byOffset(request) : this.byCursor(request);
  }

  private async byOffset(request: OffsetPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const [rows, total] = await this.context.manager().findAndCount(invoices, {
      where: tenantWhere(this.scope),
      order: totalOrder(directionOf(request)),
      take: request.limit,
      skip: request.offset,
    });

    return pageOf(rows.map(toSummary), { total });
  }

  private async byCursor(request: CursorPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const tenant = tenantWhere(this.scope);
    const rows = await this.context.manager().find(invoices, {
      where: request.cursor === undefined ? tenant : beyond(positionOf(request.cursor), direction, tenant),
      order: totalOrder(direction),
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
const totalOrder = (direction: SortDirection) => ({ amount: direction, id: direction });

// Les lignes après une position, en comparaison de tuples. Une liste de conditions est un OR en TypeORM,
// donc chaque alternative répète le tenant.
function beyond(
  { amount, id }: { amount: number; id: string },
  direction: SortDirection,
  tenant: TenantWhere,
): FindOptionsWhere<InvoiceRow>[] {
  const past = direction === 'asc' ? MoreThan : LessThan;

  return [
    { ...tenant, amount: past(amount) },
    { ...tenant, amount, id: past(id) },
  ];
}
```

`positionOf(cursor)` décode avec `decodeCursor` et vérifie que `amount` est un nombre et `id`
une chaîne, en levant `InvalidPageRequestError` sinon.

Un adaptateur de lecture sur la base de données se déclare avec `@Repository`, comme ceux que
génère la CLI : sa nature est `repository`. Déclaré avec `@Adapter`, il serait `external`, et
une plateforme générée entoure chaque adaptateur `external` et `gateway` d'une nouvelle
tentative (retry) et d'une limite de temps, ce qu'une instruction de l'unité de travail ne doit
pas recevoir.

Les règles que tiennent ces exemples, et que les tests de ce *package* vérifient sur une vraie
base de données :

- **Les colonnes d'audit** sont remplies par l'adaptateur, jamais par l'agrégat :
  `stampCreation(scope, clock)` à l'insertion, `stampUpdate(scope, clock)` à la mise à jour, qui
  laisse `created_at` et `created_by` intacts. L'acteur est celui de la portée d'exécution :
  l'utilisateur de la requête HTTP, ou `system:<consumer>` pour un événement consommé.
- **Le tenant fait partie de chaque instruction** : écrit à l'insertion (`tenantScopeOf`), et dans
  la condition de chaque lecture (`tenantWhere`) et de chaque mise à jour (`ownTenantWhere`), garde
  de version comprise. Une ligne d'un autre *tenant* n'est pas trouvée, et une mise à jour qui la
  vise n'écrit rien, ce que `optimisticUpdate` signale par une `ConcurrencyError`. Une élévation du
  personnel de la plateforme élargit ce qu'une lecture atteint, jamais ce qu'une écriture touche.
  Un travail qui ne nomme aucun *tenant* lève `NoCurrentTenantError` avant tout SQL. Le contrat
  d'isolation des *tenants* de `@ddd-ts-kit/testing` le prouve sur ce *repository*.
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

## Critères

`criteriaToTypeOrm(builder, plan, { alias })` ajoute un plan de critères du noyau à un
`SelectQueryBuilder` sur l'entité d'un modèle de lecture : les filtres et le périmètre de
l'acteur, le *keyset* d'une page par curseur, l'ordre total terminé par le champ qui départage,
la fenêtre. `predicateToTypeOrm(builder, predicate, { alias })` ajoute les filtres seuls, pour
un comptage. Les champs du modèle de lecture sont les propriétés de l'entité (`properties`
renomme celles qui diffèrent). Chaque valeur est un paramètre nommé ; le seul texte composé est
`alias.property` avec un opérateur d'une liste fermée, tous deux venant de l'adaptateur. Une
recherche textuelle est `LIKE :p ESCAPE :e`, avec `%`, `_` et `\` échappés.

```ts
// infrastructure/persistence/type-orm-appointment-queries.reader.ts
async search(criteria: ScopedCriteria<AppointmentRow>): Promise<Page<AppointmentRow>> {
  const plan = planCriteria(appointmentCriteria, criteria);

  if (plan.empty) {
    return pageOfPlan(plan, []);
  }

  const builder = this.context.manager().createQueryBuilder(appointmentList, 'row');

  return pageOfPlan(plan, await criteriaToTypeOrm(builder, plan, { alias: 'row' }).getMany());
}
```

Une page par curseur est lue avec une ligne de plus que demandé : c'est ainsi que `pageOfPlan`
sait si une autre suit ; une page par offset prend son total de
`predicateToTypeOrm(...).getCount()`. Un champ déclaré `nullable` est trié `NULLS LAST` en
ordre croissant et `NULLS FIRST` en ordre décroissant. Deux critères dans une même requête
prennent des noms de paramètres distincts avec l'option `parameters`.

**Chaînes.** Une colonne de texte est triée et comparée par intervalle selon la collation de la
colonne ; les critères trient les chaînes par point de code. Déclarez avec `collation: 'C'` les
colonnes de texte triées ou comparées avec `gt`, `lt` ou `between` : l'index sert alors le tri,
et l'ordre est le même que dans le *fake*. **Les décimaux** sont une colonne `numeric` et une
chaîne dans la ligne ; ils reviennent à l'échelle de la colonne. **Les instants** sont
`timestamptz` et une `Date`. Un entier est `integer` : un `bigint` revient du pilote sous forme
de chaîne.

## Modèles de lecture

```ts
// infrastructure/persistence/appointment-list.schema.ts
export const appointmentList = new EntitySchema<AppointmentRow & ReadModelStamps>({
  name: 'AppointmentRow',
  tableName: 'appointment_list',
  schema: 'scheduling',
  columns: {
    id: { type: 'text', primary: true },
    status: { type: 'text' },
    startsAt: { name: 'starts_at', type: 'timestamp with time zone', precision: 3 },
    ...readModelColumns(), // last_event_id, last_event_at, last_event_version, deleted
  },
});

// infrastructure/persistence/type-orm-appointment-list.repository.ts
@Repository(AppointmentList)
export class TypeOrmAppointmentList extends TypeOrmReadModelStore<AppointmentRow> implements AppointmentList {
  constructor(context: TypeOrmContext) {
    super(context, { entity: appointmentList, definition: appointmentCriteria });
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
`@ddd-ts-kit/kernel` ([Reconstruction](../kernel/README.fr.md#reconstruction)). Le store passe
`criteriaContract` et `readModelStoreContract` de `@ddd-ts-kit/testing/contracts`, sur PGlite et
sur PostgreSQL 18.
Les critères et les modèles de lecture n'ont jamais été exécutés sur MySQL ni SQLite.

La table s'écrit par son entité ; la copie d'une reconstruction, qui n'en a pas, s'écrit colonne
par colonne avec le même *query builder*.

Un modèle de lecture de données de *tenant* prend `tenant: { scope }` (et `property` quand
l'entité porte le *tenant* ailleurs que dans `tenantId`, que `tenantColumn()` déclare) : chaque
ligne s'écrit avec le *tenant* du travail en cours, chaque lecture, recherche et écriture lui est
confinée, une élévation du personnel de la plateforme n'élargissant que les lectures, et la copie
d'une reconstruction suit les mêmes conditions. Les clés restent uniques entre les *tenants*,
puisque le conflit d'une insertion porte sur la seule clé : une clé que deux *tenants* pourraient
partager (un jour, un *slug*) porte le *tenant* (`acme:2026-03-01`). Un registre construit sans
`tenant` dans un projet `--tenancy shared-table` est signalé par `tenancy/scoped-statement`.

## Effacement des données personnelles

L'effacement d'une personne concernée des tables d'un contexte, à partir des déclarations
`personalFields` écrites à côté de ses *mappers* (`@ddd-ts-kit/kernel`, « Données personnelles ») :
`TypeOrmPersonalDataErasure` implémente le port `PersonalDataErasure` sur le gestionnaire d'entités de l'unité de travail. Le port du contexte étend celui du
kernel, et son adaptateur étend cette classe.

```ts
// infrastructure/persistence/person.personal-fields.ts : le schéma d'entité lui-même, les colonnes par les propriétés de l'entité
export const personPersonalFields = personalFields<PersonRow, EntitySchema>(personEntity, {
  subject: 'id',
  fields: ['displayName', 'email'],
  erasure: 'row',
});

// infrastructure/persistence/type-orm-identity-erasure.repository.ts
@Repository(IdentityErasure)
export class TypeOrmIdentityErasure extends TypeOrmPersonalDataErasure implements IdentityErasure {
  constructor(database: TypeOrmContext, scope: ExecutionScope, files: FileStorage) {
    super(database, { name: 'identity.persons', declarations: [personPersonalFields], tenant: { scope }, files });
  }
}
```

`erase(subject)` supprime d'abord du stockage les fichiers que les lignes nomment, puis supprime les
lignes de la personne (`row`) ou les pseudonymise (`pseudonymise` : une colonne texte lit `[erased]`,
une colonne de tout autre type ne lit rien, une colonne de fichier rien), et répond combien de lignes
il a atteintes, aucune la seconde fois. Avec `tenant`, chaque instruction est confinée au *tenant* du
travail et jamais élargie par une élévation (la propriété `tenantId`, ou `tenant.property`) ; sans lui, la table tient les lignes de tous
les *tenants*. Un sujet qui n'est pas un identifiant opaque est refusé avant toute instruction, et une
déclaration qui nomme des colonnes de fichier sans stockage de fichiers est refusée à la construction
de l'adaptateur. Les types des colonnes viennent des métadonnées de l'entité (`String` vaut pour un texte), pour qu'un texte et un nombre soient pseudonymisés chacun à sa façon. Une colonne personnelle qui n'est pas un texte doit accepter null, sinon
les lignes s'effacent avec `row` : une déclaration qui en pseudonymiserait une qui ne l'accepte pas
est refusée avant qu'un fichier ou une ligne ne soit touché (`NotNullablePersonalColumnError`). L'adaptateur passe `personalDataErasureContract` de
`@ddd-ts-kit/testing`, comme celui en mémoire, sur PGlite et PostgreSQL. Ce qu'un effacement
n'atteint pas, et la chaîne entière (`eraseDataSubject` : la clé, chaque copie dans chaque *tenant*,
les reconstructions), sont dans le README du kernel (« Données personnelles »).

`TypeOrmPersonalDataExport` répond au droit d'accès et à la portabilité à partir des mêmes déclarations :
`exportOf(subject)` remet un `PersonalDataRecord` par ligne sur la personne dans chaque table déclarée,
sous `<name>.<table>`, avec chaque colonne personnelle et chaque colonne de fichier (par sa clé) en
données simples, par les propriétés de l'entité, aucune autre colonne et rien de personne d'autre ; une ligne déjà
pseudonymisée répond ce qu'elle lit. La même option `tenant` confine chaque instruction au *tenant* du
travail, un sujet qui n'est pas un identifiant opaque est refusé avant toute instruction, et
l'adaptateur passe `personalDataExportContract`. Le port du contexte étend `PersonalDataExport` du
kernel et son adaptateur étend cette classe avec `name`, `declarations` et `tenant`
(`TypeOrmPersonalDataExportOptions`) ; `generate repository --personal` écrit les deux adaptateurs, et
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

![Deux relais se partagent l'outbox : avec skip-locked, chacun sélectionne les lignes dues FOR UPDATE SKIP LOCKED dans une courte transaction et le relais B saute les lignes que le relais A a verrouillées ; avec compare-and-set, les deux lisent la ligne 7 et tentent une mise à jour gardée par le nombre de tentatives lu, le premier la prend et le second n'écrit aucune ligne et relit ; dans les deux cas, une ligne prise reste cachée jusqu'à la fin de son bail](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/typeorm-outbox-claim.fr.svg)

- `TypeOrmOutboxStore.claimBatch` sélectionne les lignes dues `FOR UPDATE SKIP LOCKED`
  (`setLock('pessimistic_write').setOnLocked('skip_locked')`) et les prend à bail dans la même
  courte transaction en repoussant `next_attempt_at` (`leaseMs`, 30 s par défaut) : plusieurs
  relais se partagent ainsi le travail sans s'attendre, et les enregistrements d'un relais mort
  reviennent quand le bail expire. La livraison est au moins une fois et, par défaut, sans
  ordre : `ordering: 'per-key'` de `OutboxRelay`, muni d'un `keyOf` (en général l'identifiant
  de l'agrégat), garde dans l'ordre les enregistrements d'une même clé, avec un seul relais ([L'ordre par clé](../events/README.fr.md#lordre-par-clé)).
- Là où la base n'a pas de `SKIP LOCKED` (SQLite), ou quand vous passez
  `claim: 'compare-and-set'`, la prise lit les lignes dues et prend chacune par une mise à jour
  gardée par le nombre de tentatives lu : même garantie, aucune clause de verrou, une
  instruction par enregistrement. La valeur par défaut est `skip-locked` pour les pilotes
  `postgres`, `aurora-postgres`, `cockroachdb`, `mysql` et `aurora-mysql`, `compare-and-set`
  pour tous les autres.
- `TypeOrmProcessedEventStore.markProcessed` est une insertion qui ignore le conflit sur
  `(consumer, event_id)`. Exécutez le consommateur dans l'unité de travail : la marque est alors
  validée avec les effets du gestionnaire, et disparaît avec eux s'il échoue.
- `outboxEntity({ tenant: true })` ajoute `tenant_id`, nullable, et le registre y écrit le *tenant*
  de chaque événement, si bien que ses consommateurs s'exécutent dans ce *tenant* : l'outbox d'un
  projet multi-tenant. Un projet qui devient multi-tenant l'active et génère la migration qui
  ajoute la colonne ; les événements publiés avant elle n'appartiennent à aucun *tenant*.

Les options du store de l'outbox, et le relais qui le lit :

<!-- checked sample -->
```ts
import { OutboxRelay } from '@ddd-ts-kit/events';
import type { Clock, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { outboxEntity, TypeOrmOutboxStore, type TypeOrmUnitOfWork } from '@ddd-ts-kit/typeorm';

// Depuis la racine de composition : createTypeOrmUnitOfWork(dataSource), l'adaptateur du broker, l'horloge.
declare const unitOfWork: TypeOrmUnitOfWork;
declare const broker: IntegrationEventPublisher;
declare const clock: Clock;

export const outbox = outboxEntity({ schema: 'messaging' }); // l'entité que la source de données enregistre

const store = new TypeOrmOutboxStore(unitOfWork, {
  entity: outbox,
  leaseMs: 60_000, // un enregistrement pris par un relais mort redevient dû au bout d'une minute
  claim: 'compare-and-set', // au lieu de la valeur par défaut du pilote, par exemple sur MySQL 5.7
});

const relay = new OutboxRelay({ store, publisher: broker, clock });

relay.start({ intervalMs: 500 });
```

Un consommateur sur le store des événements traités : `consume` de `@ddd-ts-kit/events` exécute
la marque et le gestionnaire dans une seule unité de travail
([Consommer de façon idempotente](../events/README.fr.md#consommer-de-façon-idempotente)).

<!-- checked sample -->
```ts
import { z } from 'zod';
import { consume, defineIntegrationEvent } from '@ddd-ts-kit/events';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { processedEventEntity, TypeOrmProcessedEventStore, type TypeOrmUnitOfWork } from '@ddd-ts-kit/typeorm';

// Depuis la racine de composition et le contexte : l'unité de travail, et ce que fait le consommateur.
declare const unitOfWork: TypeOrmUnitOfWork;
declare function issueInvoice(orderId: string): Promise<void>;

// La déclaration du producteur, dans son langage publié.
const orderPlaced = defineIntegrationEvent({
  type: 'ordering.order.placed',
  version: 1,
  description: 'An order was placed by a customer.',
  payload: zodSchema(z.object({ orderId: z.string() })),
});

const processed = new TypeOrmProcessedEventStore(unitOfWork, {
  entity: processedEventEntity({ schema: 'messaging' }),
});

// La marque dans messaging.processed_events et les écritures d'issueInvoice sont validées en une transaction :
// une nouvelle livraison est ignorée, et un événement dont le gestionnaire a levé une erreur est retraité quand il revient.
export const invoiceOnOrderPlaced = consume(
  orderPlaced,
  { consumer: 'billing.invoice-on-order-placed', processed, unitOfWork },
  async (event) => {
    await issueInvoice(event.payload.orderId);
  },
);
```

## Tâches de fond et instances de processus

`jobEntity()` et `processEntity()` sont les deux tables, sur PostgreSQL, à enregistrer dans la
source de données à côté de l'outbox (`init --orm typeorm` les place dans le schéma `messaging`).

- `TypeOrmJobStore` est le `JobStore` de `@ddd-ts-kit/scheduling`. `add` passe par le *manager*
  du contexte : une tâche mise en file par une commande existe si et seulement si la commande a
  été validée. Une prise réserve les lignes dues de la file `FOR UPDATE SKIP LOCKED` et les bail
  dans une transaction courte : plusieurs *workers* passent les uns sur les lignes des autres. Une
  clé d'idempotence est unique par nom de tâche et par tenant ; un doublon est écarté par une
  insertion qui ignore le conflit, ce qui laisse la transaction de la commande utilisable.
- `TypeOrmProcessStore` est le `ProcessStore` du noyau : une étape d'un gestionnaire de processus
  enregistre son instance dans la transaction de son unité de travail, un premier enregistrement
  écarte la ligne qu'un premier enregistrement concurrent a écrite, un suivant met à jour la ligne
  à la version précédente, et un enregistrement qui ne change aucune ligne est refusé par
  `ConcurrencyError`. Avec `tenant` (l'`ExecutionScope`), le store garde chaque instance dans le tenant du travail qui
  l'enregistre : la table repère aussi une ligne par son tenant, le texte vide hors de tout tenant,
  si bien que deux tenants peuvent utiliser la même clé de corrélation ; une instance d'un autre
  tenant n'est ni trouvée ni modifiée, et un travail qui ne nomme aucun tenant est refusé par
  `NoCurrentTenantError`.

<!-- checked sample -->
```ts
// platform/database/background-work.ts
import {
  jobEntity,
  processEntity,
  TypeOrmJobStore,
  TypeOrmProcessStore,
  type TypeOrmUnitOfWork,
} from '@ddd-ts-kit/typeorm';

// De la racine de composition : `createTypeOrmUnitOfWork(dataSource)`.
declare const unitOfWork: TypeOrmUnitOfWork;

// Enregistrées dans les `entities` de la source de données, migrées comme les autres tables.
export const jobs = jobEntity({ schema: 'messaging' });
export const processes = processEntity({ schema: 'messaging' });

export const jobStore = new TypeOrmJobStore(unitOfWork, { entity: jobs });
export const processStore = new TypeOrmProcessStore(unitOfWork, { entity: processes });
```

## Event store

```ts
const dataSource = new DataSource({ type: 'postgres', entities: [...eventStoreEntities({ schema: 'scheduling' })] });

const { events, snapshots, checkpoints, subjectKeys } = createTypeOrmEventSourcing(unitOfWork, { schema: 'scheduling' });
```

`eventStoreEntities` déclare les tables sous forme d'`EntitySchema`, si bien que
`typeorm migration:generate` les crée avec les colonnes d'`eventStoreTablesSql` du noyau. Les
stores ne les chargent jamais comme entités. Les stores de `createTypeOrmEventSourcing` refusent
une source de données qui n'est pas PostgreSQL : leur première instruction lève une `TypeError`
qui nomme son type.

Chaque instruction s'exécute sur l'exécuteur du contexte : un ajout rejoint la transaction de
l'unité de travail, si bien que le flux et les enregistrements d'outbox que publient ses
événements sont validés ensemble (`eventStoreUnitOfWorkContract`). Les ajouts prennent la tête
du store, une ligne verrouillée jusqu'à la fin de leur transaction : les positions sont données
dans l'ordre des validations, sans trou, et deux ajouts ne s'exécutent jamais côte à côte, quels
que soient leurs flux. PostgreSQL seulement. Les stores sont ceux du noyau (`PostgresEventStore`
et ses compagnons), tenus ici à `eventStoreContract` ; comment un agrégat en *event sourcing*
les utilise : le README de `@ddd-ts-kit/kernel`, section
[Event sourcing](../kernel/README.fr.md#event-sourcing).

## Couverture des dialectes

Ce qui suit concerne ce *package*. La CLI ne génère que pour PostgreSQL : `init --orm typeorm`
refuse `--database mysql` et `--database sqlite`.

| Base de données | État |
|---|---|
| PostgreSQL | Couvert par la suite automatique : suites de contrat de `@ddd-ts-kit/testing`, contrat de *repository*, annulation, unité de travail imbriquée, prises concurrentes, le store des tâches et celui des processus (PostgreSQL seulement). Elle tourne par défaut sur PGlite servi par le protocole réseau de PostgreSQL, et sur un vrai serveur quand `DDD_TS_KIT_TEST_DATABASE_URL` est définie (dernière exécution : PostgreSQL 18). |
| MySQL 8 | Hors de la suite automatique. Les suites de contrat de l'outbox et des événements traités et l'annulation d'`append` ont été exécutées une fois à la main contre MySQL 8.4 avec `mysql2`, entités construites avec `dialect: 'mysql'`, avec `skip-locked` et `compare-and-set`. |
| SQLite | Hors de la suite automatique. Les mêmes suites ont été exécutées une fois à la main avec le pilote `better-sqlite3`, entités construites avec `dialect: 'sqlite'`. Pas de `SKIP LOCKED` : la prise est `compare-and-set`. Pas de schémas : omettez `schema` et nommez les tables par contexte. |
| MariaDB, CockroachDB, SQL Server, Oracle, MongoDB | Jamais exécuté. |

## Limites

- Testé avec TypeORM 1.1. La plage de la *peer dependency* est `^1.0.0` : TypeORM 0.3 n'est pas
  accepté.
- Un `EntitySchema` est statique : les types de colonnes dépendent du `dialect` que vous passez,
  pas de la source de données dans laquelle il est enregistré.
- Une charge utile JSON `null` est stockée en `NULL` SQL et relue comme `null`.
- Sur MySQL 5.7, il n'y a pas de `SKIP LOCKED` : passez `claim: 'compare-and-set'`.
- `synchronize: true` est réservé aux tests. En production, les tables viennent de vos
  migrations.
- Par défaut, l'ordre n'est pas garanti, pas même par agrégat : un événement en échec est
  retenté plus tard pendant que ses successeurs partent. `ordering: 'per-key'` de `OutboxRelay`,
  muni d'un `keyOf`, ordonne les enregistrements d'une même clé, avec un seul relais en marche.
  Sans `keyOf`, rien n'est ordonné.

## Tester un adaptateur

L'unité de travail de ce *package* passe `unitOfWorkContract`, et ses stores
`outboxStoreContract`, `processedEventStoreContract`, `jobStoreContract` et `processStoreContract`, de `@ddd-ts-kit/testing/contracts`.
Tenez vos *repositories* à `repositoryContract` de la même façon, à côté de leur *fake* en
mémoire. Les tests de ce *package* n'ont besoin d'aucun conteneur :

```
npx vitest run packages/typeorm
DDD_TS_KIT_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres npx vitest run packages/typeorm
```

Avec la variable définie, chaque fichier de *spec* crée sa propre base de données sur ce serveur
et la supprime ensuite, et les tests qui ont besoin de deux vraies connexions (un relais qui
saute les lignes verrouillées par un autre) s'exécutent au lieu d'être ignorés.

## Voir aussi

- [Persistance](../../docs/tools/persistence.fr.md) : choisir un ORM, et ce que chaque *package* d'adaptateurs a vérifié
- [Agrégats](../../docs/concepts/aggregates.fr.md#concurrence-optimiste) : la concurrence optimiste, vue depuis le domaine
- [L'outbox transactionnelle](../../docs/concepts/transactional-outbox.fr.md) : pourquoi l'enregistrement d'outbox est validé avec l'écriture métier
- [Livraison et idempotence](../../docs/concepts/delivery-and-idempotency.fr.md) : au moins une fois, et ce qu'un consommateur en fait
- [`@ddd-ts-kit/drizzle`](../drizzle/README.fr.md) : les mêmes pièces sur Drizzle, la persistance par défaut du kit
