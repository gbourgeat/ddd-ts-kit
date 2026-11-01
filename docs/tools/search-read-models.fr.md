[English](search-read-models.md) · **Français**
<!-- translation-of: search-read-models.md sha256:716c5d470e4add82 -->

# Modèles de lecture de recherche sur OpenSearch

**En bref.** Un modèle de lecture qui sert des listes avec filtres, tris et pages peut vivre dans
OpenSearch plutôt que dans une table : `@ddd-ts-kit/opensearch` implémente le port
`ReadModelStore` du noyau, si bien qu'un projecteur ne sait pas dans quel store il écrit.
`init --search opensearch` le câble dans la plateforme : `src/platform/search/` donne à chaque
contexte `SearchIndexes`, qui construit les options d'un store avec le nœud et la stratégie de
locataires du projet déjà fixés, et provisionne l'index de chaque store construit à partir de lui.
Un index de recherche est une copie pour la lecture, reconstruite depuis les événements, jamais une
source de vérité. Chaque choix est consigné dans
[l'ADR-0008](../adr/0008-a-read-model-store-on-opensearch.fr.md) (le store) et
[l'ADR-0009](../adr/0009-init-wires-opensearch.fr.md) (le câblage).

## Ce qui convient, et ce qui ne convient pas

| Usage | Convient | Pourquoi |
|---|---|---|
| Une liste avec filtres, tris et pages sur une projection | oui | les critères du port de lecture deviennent le DSL de requête, une page par curseur est un filtre sur la clé |
| Une vue dénormalisée qui joint plusieurs agrégats ou contextes | oui | la projection écrit un document depuis les événements de chacun, par le langage publié |
| Un modèle de lecture cohérent à terme avec l'écriture | oui | une recherche voit une écriture après le rafraîchissement suivant, une seconde par défaut |
| Un fort volume de lectures tenu à l'écart de la base d'écriture | oui | le cluster prend les lectures ; la base garde les écritures |
| Relire sa propre écriture juste après une commande | non, sauf `refresh: 'wait_for'` | chaque écriture attend alors le rafraîchissement : un coût sur chaque écriture, choisi par store |
| La cohérence avec l'écriture dans une transaction | non | le document s'écrit hors de l'unité de travail ; une seconde livraison est périmée, une écriture annulée reste |
| Une source de vérité | non | l'index se reconstruit depuis les événements ; ce qui décide vit dans l'agrégat et son dépôt |
| Un invariant (unicité, solde) ou une décision d'autorisation | non | un modèle de lecture a du retard sur l'écriture : une décision prise dessus peut se tromper d'un rafraîchissement |
| Pertinence plein texte, facettes, agrégations | pas construit | une chaîne est un `keyword`, `contains` un joker sensible à la casse |
| Elasticsearch | jamais lancé | le store appelle les points d'accès que les deux partagent ; aucune spec ne tourne sur Elasticsearch |
| Une reconstruction sans interruption | pas construit | chaque index porte une génération et toute lecture passe par un alias, pour qu'une reconstruction puisse basculer |

## Ce qu'écrit `init --search opensearch`

- `@ddd-ts-kit/opensearch` dans les dépendances, à la plage du kit ;
- `config.search` dans `loadConfig` : `OPENSEARCH_URL` (requise), `OPENSEARCH_USERNAME` avec
  `OPENSEARCH_PASSWORD` (les deux ou aucune) ;
- `src/platform/search/search-indexes.ts`, la classe abstraite que reçoit chaque contexte, et
  `search/open-search.ts`, qui la construit sur `fetchTransport` avec la stratégie de locataires
  du projet : `{ strategy: 'attribute', scope }` sous `--tenancy shared-table`,
  `{ strategy: 'none' }` sinon ;
- sur tsyringe, InversifyJS et Awilix `search/search.module.ts`, qui lie `SearchIndexes` ; câblé à
  la main et sous Nest, `platform.search` ;
- un service `opensearch` dans `docker-compose.yml` (un nœud, extension de sécurité coupée, un
  demi-gibioctet de tas, port 9200), `OPENSEARCH_URL` dans `.env.example` et les variables dans le
  README.

L'index de chaque store construit depuis `SearchIndexes` est provisionné avant sa première requête :
`ensureMapping()` sans locataires, `provision(tenant)` pour chaque locataire de `TENANTS` sous
tables partagées. La composition provisionne les stores construits au moment où elle démarre ; les
conteneurs construisent un adaptateur quand un handler en a besoin la première fois, si bien qu'un
tel store est provisionné à sa propre première requête. Un projet sans store n'appelle rien :
`npm run dev`, les tests et le pipeline n'ont besoin d'aucun nœud. Les outils et les tests ne
reçoivent aucun nœud : un store construit là est refusé à sa première requête.

## Écrire un store

Aucun générateur ne l'écrit encore. Le port est une classe abstraite au-dessus de
`ReadModelStore<Row>` dans `application/ports/` ; l'adaptateur de `infrastructure/persistence/`
étend `OpenSearchReadModelStore` et reçoit `SearchIndexes` :

```ts
import { OpenSearchReadModelStore } from '@ddd-ts-kit/opensearch';
import { SearchIndexes } from '@/platform/search/search-indexes';
import { InvoiceList, type InvoiceRow } from '@/contexts/billing/application/ports/invoice-list.port';
import { invoiceCriteria } from '@/contexts/billing/application/queries/search-invoices/invoice-criteria';

export class SearchInvoiceList extends OpenSearchReadModelStore<InvoiceRow> implements InvoiceList {
  constructor(search: SearchIndexes) {
    super(search.options('billing_invoices', invoiceCriteria, { fields: { notes: 'string' } }));
  }
}
```

- Son nom commence par son contexte (`billing_invoices`) : les index et les alias se construisent
  depuis lui, et les droits du déploiement se donnent par ce préfixe.
- Seule sa projection l'écrit, par le port : `upsertIfNewer` avec le tampon de l'événement,
  `delete`, qui garde une pierre tombale pour qu'un événement plus ancien ne ramène pas la ligne.
- `domain/` ne le lit jamais, et aucun handler n'y décide un invariant ou un droit.
- Seule la plateforme connaît OpenSearch : un contexte ne nomme rien du paquet sinon
  `OpenSearchReadModelStore` et ses refus, jamais `fetchTransport`, un transport ou une stratégie
  de locataires à lui (`search/store-from-platform`, une erreur).

## Tester

- Les specs d'un contexte lient le port à `InMemoryReadModelStore` du noyau, construit avec les
  mêmes critères : un faux, jamais un mock.
- L'adaptateur est tenu à `readModelRowsContract` et `criteriaContract` de
  `@ddd-ts-kit/testing/contracts`, les suites que le paquet passe sous chaque stratégie. Elles
  demandent un nœud : lancez-les dans une spec d'intégration qui lit le nœud dans `OPENSEARCH_URL`
  et se saute sans lui, et donnez au job du pipeline qui la lance un service OpenSearch. Le pipeline
  qu'écrit `init` n'en démarre aucun.

## Locataires

Sous tables partagées, un store tient les locataires à part quoi qu'écrive un contexte, et rien de
cela n'est à fixer par un contexte :

- un travail qui ne nomme aucun locataire est refusé (`NoCurrentTenantError`) ;
- chaque locataire lit et écrit par un alias qu'OpenSearch filtre sur le champ du locataire et route
  par le locataire, si bien qu'un autre programme qui lit par lui ne voit que ce locataire ; le
  store ajoute la même condition à chaque recherche ;
- un `get` et toute écriture atteignent le locataire du travail : un document d'un autre locataire
  est répondu absent, même sous une élévation ; une élévation (`acrossTenants`) n'élargit qu'une
  `search` ;
- un locataire entre dans un nom, et celui qui n'est pas fait de minuscules, de chiffres, de `_` et
  de `-` est refusé (`InvalidIndexNameError`) ;
- un locataire est provisionné au démarrage pour chaque locataire de `TENANTS`. Un locataire créé
  plus tard demande `provision(tenant)` sur chaque store à sa création : appelez-le depuis le cas
  d'usage qui crée le locataire, par un port de la plateforme, ou redémarrez une fois que `TENANTS`
  le nomme.

### Choisir la stratégie

| Stratégie | Pour | Son coût |
|---|---|---|
| `attribute`, ce qu'écrit `init` : un index, un alias filtré par locataire | beaucoup de petits locataires | les locataires partagent des *shards* ; un locataire ne peut pas être sauvegardé, restauré ni recevoir un *mapping* à lui |
| `index` : un index par locataire | une isolation qui doit être physique : un locataire régulé, l'effacement ou le départ par la suppression d'un index, sauvegarde et restauration par locataire, un voisin bruyant, un *mapping* ou une rétention par locataire | le nombre de *shards* croît avec les locataires |

Le changement tient en une ligne de `src/platform/search/open-search.ts`
(`{ strategy: 'index', scope }`), puis une réindexation : les documents portent déjà leur
locataire sous les deux stratégies.

## Données personnelles

Le kit ne déclare encore rien pour un modèle de lecture
([Données personnelles](../concepts/personal-data.fr.md)) : un document qui porte une personne est
une copie à effacer comme une autre. Gardez sa clé un identifiant opaque. Un effacement l'atteint en
supprimant les lignes de la personne par le port, depuis la projection de l'événement d'effacement
ou depuis une copie listée dans `data-subject-copies.ts` sous `--privacy on` ; une fois la
reconstruction construite, en reconstruisant le modèle de lecture. Sous `index`, un locataire qui
part est supprimé avec ses index.

## En production

Le nœud de la pile compose tourne extension de sécurité coupée, pour une machine. Un déploiement
garde l'extension, avec TLS (`OPENSEARCH_URL` en `https://`), et donne à l'application un compte de
service (`OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`) dont le rôle couvre les index et les alias
des noms du projet seulement (`billing_*`, `shipping_*`), jamais un joker : le compte crée index et
alias au provisionnement, puis lit et écrit des documents.

## Voir aussi

- [`@ddd-ts-kit/opensearch`](../../packages/opensearch/README.fr.md) : les options, les
  locataires, le provisionnement, le client officiel derrière un transport
- [Persistance](persistence.fr.md) : les tables des quatre ORM, et quand un moteur de recherche
  convient mieux
- [Multitenance](../concepts/multitenancy.fr.md) : les stratégies du côté de l'écriture
- [ADR-0009](../adr/0009-init-wires-opensearch.fr.md) : ce que câble `init`, et ce qui défait chaque
  choix
