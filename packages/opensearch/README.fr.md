[English](README.md) · **Français**
<!-- translation-of: README.md sha256:57523eb375c8c2ae -->

# @ddd-ts-kit/opensearch

Le `ReadModelStore` du noyau sur OpenSearch : le modèle de lecture d'une projection tenu dans un
index, interrogé avec les critères du noyau traduits dans le DSL de requête, ses écritures
ordonnées par l'estampille de l'événement qui les a faites, et les documents des locataires tenus
à part par un index par locataire, ou par un champ de locataire et un alias filtré par locataire.
Il ne dépend d'aucune bibliothèque cliente : il parle l'API REST par un transport de quelques
lignes. Rien dans `domain/` ni `application/` n'importe ce paquet : un projecteur écrit sur le port
de son modèle de lecture, et la plateforme lie cet adaptateur.

```
npm i @ddd-ts-kit/opensearch
```

`init` ne le câble pas : la composition ci-dessous s'écrit à la main, et
[la décision](../../docs/adr/0008-a-read-model-store-on-opensearch.fr.md) consigne chaque choix.

## Racine de composition

<!-- checked sample -->
```ts
import { AsyncLocalStorageExecutionScope, ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';
import { OpenSearchReadModelStore, fetchTransport } from '@ddd-ts-kit/opensearch';

interface AppointmentRow {
  readonly id: string;
  readonly status: 'booked' | 'cancelled';
  readonly startsAt: Date;
  readonly fee: string;
  readonly notes: string | null;
}

// application/ports : le port du modèle de lecture, comme pour tout store
export abstract class AppointmentList extends ReadModelStore<AppointmentRow> {}

const appointmentCriteria = defineCriteria<AppointmentRow>({
  fields: {
    id: { type: 'string', filter: ['eq', 'in'] },
    status: { type: 'string', filter: ['eq', 'in'], sortable: true },
    startsAt: { type: 'instant', filter: ['gte', 'lt', 'between'], sortable: true },
    fee: { type: 'decimal', filter: ['gte', 'lte'], sortable: true },
  },
  defaultSort: [{ field: 'startsAt', direction: 'asc' }],
  tieBreaker: 'id',
});

declare const config: { readonly search: { readonly node: string; readonly username: string; readonly password: string } };

export const scope = new AsyncLocalStorageExecutionScope();

// infrastructure : l'adaptateur étend le store et n'ajoute rien
export class SearchAppointmentList extends OpenSearchReadModelStore<AppointmentRow> implements AppointmentList {
  constructor() {
    super({
      transport: fetchTransport({ node: config.search.node, auth: config.search }),
      name: 'scheduling_appointments',
      definition: appointmentCriteria,
      fields: { notes: 'string' }, // gardé avec la ligne, ni filtré ni trié
      tenancy: { strategy: 'attribute', scope }, // ou 'index', ou { strategy: 'none' }
    });
  }
}

// la plateforme, une fois par locataire à sa création (et à chaque démarrage : c'est idempotent)
export async function provisionTenant(list: SearchAppointmentList, tenantId: string): Promise<void> {
  await list.provision(tenantId);
}
```

Un projecteur écrit par le port, comme sur tout store (`@ddd-ts-kit/kernel`, « Projections ») :

```ts
@Projection('scheduling.appointment-list')
export class AppointmentListProjection {
  constructor(private readonly appointments: AppointmentList) {}

  @On(AppointmentBooked)
  booked(event: AppointmentBooked) {
    return this.appointments.upsertIfNewer(event.aggregateId, stampOf(event), () => rowOf(event));
  }

  @On(AppointmentCancelled)
  cancelled(event: AppointmentCancelled) {
    return this.appointments.delete(event.aggregateId, stampOf(event));
  }
}
```

Les options de `OpenSearchReadModelStore` :

| Option | Par défaut | |
|---|---|---|
| `transport` | requis | `fetchTransport(...)`, ou le client officiel du projet enveloppé dans un `OpenSearchTransport` |
| `name` | requis | lettres minuscules, chiffres et `_`, au plus 100 : les index et les alias en sont tirés |
| `definition` | requis | la `CriteriaDefinition` du port de lecture ; ses champs sont mappés et indexés |
| `fields` | aucun | les autres champs de la ligne avec leur type (`string`, `number`, `boolean`, `instant`, `decimal`), gardés et non indexés |
| `tenancy` | `{ strategy: 'none' }` | `none`, `index` ou `attribute`, avec le `scope` d'où le locataire est lu et le `field` du locataire (`tenantId`) |
| `refresh` | aucun | `'wait_for'` : une écriture répond une fois qu'une recherche la voit |
| `settings` | aucun | les réglages d'un index que le store crée : *shards*, réplicas, intervalle de rafraîchissement |

`fetchTransport` prend `node` (`https://search.internal:9200`), `auth` (`{ username, password }`
pour l'authentification basique, ou `{ authorization }` pour l'en-tête entier, une `ApiKey` ou un
jeton porteur) et `timeoutMs` (10 000 par défaut). Il répond à tout statut ; il rejette avec
`OpenSearchUnavailableError` seulement quand aucune réponse n'est venue. Pour utiliser le client
officiel :

```ts
const transport: OpenSearchTransport = {
  async request({ method, path, query, body }) {
    const response = await client.transport.request({ method, path, querystring: query, body }, { ignore: [404, 409] });

    return { status: response.statusCode ?? 200, body: response.body };
  },
};
```

## Locataires

| Stratégie | Index | Un locataire est lu et écrit par | Une élévation lit par |
|---|---|---|---|
| `none` | `<name>.v1` | l'alias `<name>` | |
| `index` | `<name>-<tenant>.v1`, un par locataire | l'alias `<name>-<tenant>`, sur l'index de ce locataire | l'alias `<name>`, sur l'index de chaque locataire |
| `attribute` | `<name>.v1`, partagé | l'alias `<name>-<tenant>`, filtré sur le champ du locataire et routé par le locataire | l'alias `<name>`, sur l'index partagé |

Toute lecture et toute écriture passent par un alias, jamais par un index : le store lit de la
même façon sous les deux stratégies de locataire, et le filtre de l'alias d'un locataire est
appliqué par OpenSearch lui-même : une requête envoyée par cet alias par un autre programme ne
voit que les documents de ce locataire. Le store ajoute la même condition à chacune de ses
recherches. Sous les deux stratégies de locataire :

- chaque document porte le locataire du travail dans le champ du locataire (`tenantId` par
  défaut), que le store écrit lui-même, puisqu'une écriture par un alias filtré ne l'écrit pas ;
  quand la ligne a un champ de ce nom, il porte le locataire du travail, quoi que la ligne ait dit ;
- un `get` et toute écriture atteignent le locataire du travail (`tenantScopeOf`) : un document
  d'un autre locataire est répondu absent, même sous une élévation ;
- une `search` atteint ce que `tenantReachOf` permet : le locataire du travail ou, sous
  `acrossTenants`, tous les locataires ou ceux qu'elle nomme ;
- un travail qui ne nomme aucun locataire est refusé avec `NoCurrentTenantError` ;
- sous `attribute`, l'id d'un document est `<tenant>:<key>`, si bien que deux locataires peuvent
  tenir la même clé.

Un locataire devient une partie d'un nom : il est refusé avec `InvalidIndexNameError` s'il n'est
pas fait de lettres minuscules, de chiffres, de `_` et de `-` (un id de locataire du noyau peut
tenir des majuscules : `Acme` est refusé plutôt que lu comme `acme`). Un nom de modèle de lecture
ne tient pas de `-` et un locataire pas de `.`, si bien qu'aucun alias de locataire n'est jamais le
nom d'un index ni l'alias d'un autre modèle de lecture.

**Provisionnement.** Le store ne crée jamais d'index à une écriture, où une faute de frappe dans
un nom en créerait un : une écriture et une lecture par un alias qui n'existe pas sont refusées
avec `UnprovisionedIndexError`. La plateforme appelle `ensureMapping()` pour un modèle de lecture
sans locataires et `provision(tenant)` pour chaque locataire ; les deux sont idempotents, et
ajoutent à un index existant les champs qui manquent à son *mapping* (un champ mappé avec un autre
type est refusé par OpenSearch).

## Ce qu'il fait

| Méthode du port | Sur OpenSearch |
|---|---|
| `get(key)` | `GET /<alias>/_doc/<id>` ; le locataire du document est vérifié, puisqu'un alias filtré ne filtre pas un *get* |
| `upsertIfNewer`, `delete` | le *get* ci-dessus, puis `PUT /<alias>/_doc/<id>?require_alias=true` avec `op_type=create` pour une clé nouvelle, ou `if_seq_no` et `if_primary_term` du document lu ; sur un conflit il relit, cinq tentatives, puis `ConcurrencyError` |
| `search(scopedCriteria)` | `POST /<alias>/_search` : chaque opérateur, groupe, tri et page des critères en filtres du DSL de requête ; les lignes supprimées laissées de côté ; une page par décalage comptée exactement (`track_total_hits`) |
| `ensureMapping()`, `provision(tenant)` | `PUT /<index>`, `PUT /<index>/_mapping`, `POST /_aliases` |

Ces *endpoints* sont ceux qu'Elasticsearch partage, mais le store n'a tourné que sur OpenSearch.

**Mapping.** Il est `dynamic: 'strict'` : un champ d'une ligne que le modèle de lecture ne déclare
pas est refusé à l'écriture (`OpenSearchRequestError`, `strict_dynamic_mapping_exception`). Les
champs de la définition sont indexés : `string` en `keyword` (comparé par point de code, comme les
critères), `number` en `double`, `boolean`, `instant` en `date` à la milliseconde. Un `decimal` est
gardé tel qu'il a été écrit et comparé par une clé d'ordre (`_ddd_order.<field>`), un *keyword*
dont l'ordre des octets est l'ordre des nombres : pas de flottant, pas d'arrondi. L'estampille et
la suppression vivent dans `_ddd_stamp` et `_ddd_deleted` ; `get` et `search` ne rendent que les
champs déclarés.

**Ordre.** Un remplacement est conditionné au numéro de séquence du document lu : deux événements
d'une même clé ne s'écrasent jamais à l'aveugle, et la règle de l'estampille est celle du noyau
(`isNewer`). Une ligne supprimée reste comme une trace avec son estampille : un événement plus
ancien livré en retard ne la fait pas revenir.

**Les pages par curseur** sont des pages par jeu de clés (*keyset*), comme sur les stores SQL : la
position que tient le curseur devient un filtre (`plan.seek`), pas `search_after`, dont les valeurs
sont celles du moteur (millisecondes depuis l'époque, clés d'ordre) plutôt que celles de la ligne.
**Les pages par décalage** utilisent `from` et `size`, bornés par `index.max_result_window`
(10 000 par défaut).

**Rafraîchissement.** Une écriture répond tout de suite, et une recherche la voit après le
rafraîchissement suivant de l'index (une seconde par défaut) : le côté lecture est cohérent à
terme, et `get` lit le document tout de suite. `refresh: 'wait_for'` fait attendre chaque écriture
jusqu'à ce qu'une recherche la voie, au prix de cette attente à chaque écriture ; c'est ce que
les specs utilisent.

## Limites

- **Pas de transaction avec la base.** Une écriture dans OpenSearch ne se valide pas avec la
  marque d'événement traité de l'unité de travail, comme le fait l'écriture d'un store SQL. Une
  panne entre les deux livre l'événement à nouveau, et l'estampille rend cette livraison `stale` :
  rien n'est appliqué deux fois. Une écriture réussie dans une unité de travail qui s'annule n'est
  pas défaite.
- **Pas encore de reconstruction.** `ProjectionRebuild` refuse ce store avec
  `UnsupportedRebuildError`. Les noms la gardent ouverte : chaque index porte sa génération (`v1`),
  toute lecture et toute écriture passent par un alias, si bien qu'une reconstruction remplit `v2`
  et déplace l'alias en un appel `_aliases`.
- **Pas de recherche plein texte.** Une `string` est un `keyword` : `contains` est une requête
  *wildcard*, sensible à la casse, et lente sur un gros index. L'analyse de texte, la pertinence et
  les facettes ne sont pas construites.
- **Une chaîne jusqu'à 32 766 octets** dans un champ filtré : Lucene refuse un terme plus long.
- Les pages par décalage s'arrêtent à `index.max_result_window` ; au-delà, paginer par curseur.

## Tests

`readModelRowsContract` et `criteriaContract` de `@ddd-ts-kit/testing/contracts` (réexportés par
`@ddd-ts-kit/opensearch/testing`) sous chaque stratégie, et les specs des locataires : deux
locataires, chacun ne voit et ne change que ses documents, une recherche ne rend jamais ceux d'un
autre, une élévation lit à travers, un travail sans locataire et un locataire non provisionné sont
refusés, et aucune écriture ne crée d'index. Elles tournent sur un OpenSearch en mémoire, dans le
processus, qui sert en HTTP le sous-ensemble de l'API REST que le store appelle, et sur le serveur
que nomme `DDD_TS_KIT_TEST_OPENSEARCH_URL` : OpenSearch 3 dans le pipeline, avec le plugin de
sécurité désactivé. `readModelStoreContract`, qui ajoute la reconstruction, ne tourne pas : il n'y
a pas de reconstruction.
