[English](0009-init-wires-opensearch.md) · **Français**
<!-- translation-of: 0009-init-wires-opensearch.md sha256:f4cfc2145619e2ff -->

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
| Quand un index est provisionné | avant une requête : sans locataires, `ensureMapping()` une fois par store ; sous tables partagées, `provision(tenant)` pour le locataire du travail, une fois par store et par locataire, quand le `TenantDirectory` de la plateforme le liste (celui que lisent les jobs, que le *preset* d'identité lit depuis ses organisations) ; un locataire qu'il ne liste pas, un travail sans locataire et une élévation ne provisionnent rien, et le store refuse un alias qui n'existe pas | les conteneurs construisent un adaptateur quand un handler en a besoin la première fois, si bien qu'un provisionnement au seul démarrage ne trouverait aucun store ; un locataire créé après le démarrage est provisionné à sa première requête, et un locataire inconnu ou forgé ne crée jamais d'index | le provisionnement au démarrage seul, une fois que les conteneurs construisent les adaptateurs au démarrage |
| Le démarrage | provisionne, au mieux, chaque locataire que liste l'annuaire pour chaque store construit d'ici là : sans nœud il ne fait rien, et un échec est un avertissement du *logger* de la plateforme ; le démarrage continue | un modèle de lecture pas encore provisionné n'est pas une application qui ne peut démarrer ; le chemin d'une requête provisionne de nouveau avant d'envoyer et échoue fermé | un démarrage qui échoue sur la recherche, en relançant l'erreur dans `provision()` |
| L'échec d'un locataire | le sien : un locataire qu'OpenSearch ne peut nommer (`InvalidIndexNameError`) ou dont le provisionnement a échoué est retenté à sa requête suivante, les autres locataires intacts ; `loadConfig` refuse une entrée de `TENANTS` qui n'est pas en minuscules | un locataire ne doit pas faire tomber un store pour les autres | rien à défaire |
| Un nom construit deux fois | la même définition et les mêmes champs réutilisent le store, comme un conteneur qui résout deux fois un adaptateur ; une autre définition ou d'autres champs lèvent `SearchNameTakenError` | deux modèles de lecture partageraient les index d'un nom ; un nom commence par son contexte par convention, ce que rien n'impose au-delà des droits du compte de service | un registre des noms par contexte, vérifié au démarrage |
| Un projet sans store | n'appelle rien : aucune requête au démarrage | `npm run dev`, les tests du projet et les exécutions de bout en bout du kit n'ont besoin d'aucun nœud | rien à défaire |
| La disponibilité | aucune vérification de disponibilité sur OpenSearch | un modèle de lecture en retard n'est pas une application qui ne peut répondre ; la première requête d'un store dit quand le nœud est absent (`OpenSearchUnavailableError`) | une vérification dans `ready()` de l'application, à côté de celle de Redis |
| Les outils et les tests | ne reçoivent aucun nœud : le démarrage ne provisionne rien et un store est refusé à sa première requête ; la configuration des tests de bout en bout nomme `http://localhost:9200` pour qu'elle se charge ; les scripts de confidentialité reçoivent le nœud, si bien qu'un effacement par une copie listée dans `data-subject-copies.ts` atteint OpenSearch | les specs d'un contexte lient le port à `InMemoryReadModelStore` ; un test de bout en bout qui passe par un store relie son port au store en mémoire dans la composition de bout en bout (la région `ddd-ts-kit:e2e-fakes`), ce que recommande le kit, ou reçoit un nœud | `search: config.search` dans `test/e2e/support/start-application.ts`, avec un nœud dans le pipeline |
| Un générateur | aucun : un contexte écrit son adaptateur à la main, comme le montrent les consignes du projet | le port d'un modèle de lecture n'est pas encore généré non plus (`generate projection` écrit le projecteur seul) | `generate read-model --search`, avec le port, une fois que le générateur de projections écrit le port |
| Le pipeline d'un projet généré | inchangé : aucun service OpenSearch, rien ne l'appelle dans ses tests | un projet sans store paierait un nœud pour rien | un service OpenSearch dans le job d'intégration, une fois qu'un projet y tient un adaptateur à ses contrats |
| Un contexte qui fixe son propre transport ou sa stratégie de locataires | refusé par `search/store-from-platform` sur le texte de chaque fichier de production d'un contexte : un import ne nomme qu'`OpenSearchReadModelStore` et ses refus ; le store n'est nommé que dans son import et dans `extends OpenSearchReadModelStore<` ; une classe qui l'étend a un constructeur qui appelle `super(<paramètre>.options(..))` ; aucun fichier d'un contexte n'étale `...<x>.options(` | des vérifications structurelles du texte coûtent peu et ne se trompent pas sur un champ de ligne nommé `transport` | une règle sur l'arbre syntaxique, si un contournement que le texte ne montre pas se présente |
| Le nœud de la pile compose | `opensearchproject/opensearch:3`, épinglé par le *digest* sur lequel le kit lance ses specs, un nœud, extension de sécurité coupée, un demi-gibioctet de tas, port 9200, un volume | le serveur sur lequel le paquet est prouvé, pour une machine | une autre étiquette dans `docker-compose.yml` |
| Les variables | `OPENSEARCH_URL` requise ; `OPENSEARCH_USERNAME` et `OPENSEARCH_PASSWORD` les deux ou aucune | l'utilisateur de l'extension de sécurité est ce que fixe un déploiement ; l'une des deux seule est une erreur | un en-tête `authorization` (`ApiKey`, `Bearer`) dans `readSearch`, que `fetchTransport` prend déjà |

## Conséquences

Un projet qui ajoute un store obtient son index créé avant la première requête, sous la stratégie
de locataires du projet, sans une ligne de câblage ; un locataire créé plus tard, une organisation
du *preset* d'identité comprise, reçoit son alias à sa première requête, sans redémarrage. Les
tests de bout en bout d'un projet ne donnent aucun nœud : une spec qui passe par un store relie son
port au store en mémoire dans la composition de bout en bout, ou reçoit un nœud. Le script
`infra:up` démarre le nœud avec le reste de la pile compose, environ un gibioctet de mémoire.

## Étapes suivantes

- `search/store-from-platform` lit le texte, pas l'arbre syntaxique : une option fixée après le
  constructeur, ou un store atteint par une variable d'un autre type, n'est pas vu.

## Quand y revenir

Quand le générateur de projections écrira le port d'un modèle de lecture (un générateur de
l'adaptateur OpenSearch), quand la reconstruction du store existera (un job de la plateforme), et
quand un second moteur de recherche viendra (une seconde valeur de `stack.search`).
