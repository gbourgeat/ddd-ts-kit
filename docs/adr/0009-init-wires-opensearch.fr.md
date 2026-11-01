[English](0009-init-wires-opensearch.md) · **Français**
<!-- translation-of: 0009-init-wires-opensearch.md sha256:b81ba5725fa8c086 -->

# ADR-0009 : init câble OpenSearch

## Décision

`init --search opensearch` câble `@ddd-ts-kit/opensearch` ([ADR-0008](0008-a-read-model-store-on-opensearch.fr.md))
dans la plateforme d'un projet généré : `src/platform/search/` donne à chaque contexte
`SearchIndexes`, qui construit les options d'un `OpenSearchReadModelStore` pour un nom et une
définition avec le transport et la stratégie de locataires du projet fixés, et provisionne l'index
de chaque store construit à partir de lui. Le vérificateur y tient un contexte
(`search/store-from-platform`). Comment un store s'écrit, se teste et tient ses locataires à part :
[Modèles de lecture de recherche](../tools/search-read-models.fr.md).

Chaque choix ci-dessous était ouvert ; celui retenu est le plus facile à défaire, et la dernière
colonne dit ce qui le défait.

| Choix | Retenu | Pourquoi | Ce qui le défait |
| --- | --- | --- | --- |
| Le drapeau | `--search opensearch\|none`, consigné en `stack.search`, `none` par défaut et pour une configuration qui ne dit rien | une clé pour ce qu'est le moteur de recherche, à côté de `storage` et de `cache` ; un second moteur est une seconde valeur, pas un second drapeau | renommer la clé, avec une ligne `To move:` : une lecture dans `parse-stack.ts` |
| Ce que reçoit un contexte | `SearchIndexes`, une classe abstraite de la plateforme : `options(name, definition, settings?)` et `provision()` | l'adaptateur garde la forme que montre le README du paquet (`extends OpenSearchReadModelStore`), et seule la plateforme connaît le nœud et la stratégie de locataires ; une classe abstraite est ce qu'un constructeur déclaré peut nommer | une fabrique de stores à sa place : les adaptateurs changent une ligne chacun |
| La stratégie de locataires | `{ strategy: 'attribute', scope }` sous `--tenancy shared-table`, avec la portée d'exécution de la plateforme ; `{ strategy: 'none' }` sans locataires | les tables partagées sont une table pour tous les locataires : un index pour tous les locataires est le même choix, et beaucoup de petits locataires coûtent peu de *shards* | `{ strategy: 'index', scope }` dans `search/open-search.ts`, puis une réindexation : les documents portent leur locataire sous les deux |
| Quand un index est provisionné | avant la première requête de chaque store, et au démarrage pour les stores construits d'ici là ; `ensureMapping()` sans locataires, `provision(tenant)` pour chaque locataire de `TENANTS` | les conteneurs construisent un adaptateur quand un handler en a besoin la première fois, si bien qu'un provisionnement au seul démarrage ne trouverait aucun store ; le provisionnement est idempotent | le provisionnement au démarrage seul, une fois que les conteneurs construisent les adaptateurs au démarrage |
| Un projet sans store | n'appelle rien : aucune requête au démarrage | `npm run dev`, les tests du projet et les exécutions de bout en bout du kit n'ont besoin d'aucun nœud | rien à défaire |
| La disponibilité | aucune vérification de disponibilité sur OpenSearch | un modèle de lecture en retard n'est pas une application qui ne peut répondre ; la première requête d'un store dit quand le nœud est absent (`OpenSearchUnavailableError`) | une vérification dans `ready()` de l'application, à côté de celle de Redis |
| Les outils et les tests | ne reçoivent aucun nœud : un store construit là est refusé à sa première requête ; la configuration des tests de bout en bout nomme `http://localhost:9200` pour qu'elle se charge | un test d'un contexte lie le port à `InMemoryReadModelStore`, et un test qui atteint un nœud par accident échoue plutôt que de passer sur un autre nœud | `search: config.search` dans `test/e2e/support/start-application.ts` |
| Un générateur | aucun : un contexte écrit son adaptateur à la main, comme le montrent les consignes du projet | le port d'un modèle de lecture n'est pas encore généré non plus (`generate projection` écrit le projecteur seul) | `generate read-model --search`, avec le port, une fois que le générateur de projections écrit le port |
| Le pipeline d'un projet généré | inchangé : aucun service OpenSearch, rien ne l'appelle dans ses tests | un projet sans store paierait un nœud pour rien | un service OpenSearch dans le job d'intégration, une fois qu'un projet y tient un adaptateur à ses contrats |
| Un contexte qui fixe son propre transport ou sa stratégie de locataires | refusé par `search/store-from-platform` sur les imports : un contexte nomme `OpenSearchReadModelStore` et ses refus, rien d'autre du paquet | un import se lit à peu de frais et attrape le transport et la stratégie écrits à la main | une règle qui lit l'argument de `super(...)`, l'étape suivante ci-dessous |
| Le nœud de la pile compose | `opensearchproject/opensearch:3`, épinglé par le *digest* sur lequel le kit lance ses specs, un nœud, extension de sécurité coupée, un demi-gibioctet de tas, port 9200, un volume | le serveur sur lequel le paquet est prouvé, pour une machine | une autre étiquette dans `docker-compose.yml` |
| Les variables | `OPENSEARCH_URL` requise ; `OPENSEARCH_USERNAME` et `OPENSEARCH_PASSWORD` les deux ou aucune | l'utilisateur de l'extension de sécurité est ce que fixe un déploiement ; l'une des deux seule est une erreur | un en-tête `authorization` (`ApiKey`, `Bearer`) dans `readSearch`, que `fetchTransport` prend déjà |

## Conséquences

Un projet qui ajoute un store obtient son index créé avant la première requête, sous la stratégie
de locataires du projet, sans une ligne de câblage. Les tests de bout en bout d'un projet ne donnent
aucun nœud : une spec qui passe par un store ne l'atteint qu'une fois que `start-application.ts`
passe le nœud. Le script `infra:up` démarre le nœud avec le reste de la pile compose, environ un
gibioctet de mémoire.

## Étapes suivantes

- `search/store-from-platform` lit le texte : outre les imports, un fichier d'un contexte qui
  importe le paquet ne nomme ni `tenancy`, ni `strategy`, ni `transport` dans son code, si bien
  qu'un remplacement dans la réponse de `search.options` est refusé ; une clé atteinte par un nom
  calculé n'est pas vue. L'étape suivante lit l'argument de `super(...)` dans une classe qui étend
  `OpenSearchReadModelStore` : ce doit être l'appel d'`options` sur un paramètre typé
  `SearchIndexes`.
- Un locataire créé après le démarrage n'est provisionné par la plateforme qu'au démarrage suivant ;
  un port de la plateforme qu'appelle le cas d'usage qui crée un locataire est l'étape suivante,
  avec le *preset* d'identité.

## Quand y revenir

Quand le générateur de projections écrira le port d'un modèle de lecture (un générateur de
l'adaptateur OpenSearch), quand la reconstruction du store existera (un job de la plateforme), et
quand un second moteur de recherche viendra (une seconde valeur de `stack.search`).
