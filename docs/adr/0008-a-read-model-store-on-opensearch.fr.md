[English](0008-a-read-model-store-on-opensearch.md) · **Français**
<!-- translation-of: 0008-a-read-model-store-on-opensearch.md sha256:a3fc7d7f44e74549 -->

# ADR-0008 : un store de modèle de lecture sur OpenSearch

## Décision

`@ddd-ts-kit/opensearch` est une seconde sorte de store pour le port `ReadModelStore` du noyau, à
côté des quatre ORM : `OpenSearchReadModelStore` tient le modèle de lecture d'une projection dans
un index OpenSearch, étend `TableReadModelStore` au-dessus d'une `ReadModelTable` à lui, et passe
`readModelRowsContract` et `criteriaContract` de `@ddd-ts-kit/testing` sous chacune de ses trois
stratégies de locataires, sur un OpenSearch en mémoire et sur OpenSearch 3. C'est la réponse à la
question 3 de [la proposition sur le côté lecture](../proposals/read-side.fr.md) : OpenSearch
d'abord, par le sous-ensemble de l'API REST qu'Elasticsearch partage.

Chaque choix ci-dessous était ouvert ; celui qui est pris est le plus facile à défaire, et la
dernière colonne dit ce qui le défait.

| Choix | Pris | Pourquoi | Ce qui le défait |
| --- | --- | --- | --- |
| Le port | `ReadModelStore<Row>` du noyau, par `TableReadModelStore` | un projecteur ne sait pas dans quel store il écrit, et la règle de l'estampille et les nouvelles tentatives sont écrites une fois (`writeIfNewer`) | rien à défaire : un autre port serait une seconde façon d'écrire un modèle de lecture |
| Une bibliothèque cliente | aucune : un `OpenSearchTransport` d'une méthode, et `fetchTransport` sur le `fetch` de Node | pas de pair à tenir à parité avec deux familles de clients (OpenSearch et Elasticsearch), et un projet peut envelopper son propre client en quelques lignes | une entrée de sous-chemin au-dessus du client officiel, à côté de `fetchTransport`, le store inchangé |
| Les *endpoints* | `_doc` (lecture, indexation conditionnelle avec `require_alias`), `_search`, création d'index, `_mapping`, `_aliases` | le sous-ensemble qu'Elasticsearch partage ; rien qui soit propre à OpenSearch | un passage des mêmes specs sur Elasticsearch le prouve, ou nomme ce qui diffère |
| Tout accès par un alias | `<name>`, `<name>-<tenant>` | les mêmes lectures sous chaque stratégie, et la reconstruction gardée ouverte | rien à défaire : un alias ne coûte rien |
| Stratégie `index` | `<name>-<tenant>.v1`, un index par locataire, avec l'alias du locataire et `<name>` | un locataire se supprime, se dimensionne ou se déplace seul | réindexer dans l'index partagé et déplacer les alias : les documents portent déjà leur locataire |
| Stratégie `attribute` | un `<name>.v1` ; par locataire un alias filtré (`term` sur le champ du locataire) routé par le locataire | des milliers de locataires sur peu de *shards*, et le filtre imposé par OpenSearch, pas seulement par la requête | réindexer dans un index par locataire et déplacer les alias |
| Le champ du locataire sous `index` aussi | le store l'écrit sous les deux stratégies de locataire | passer d'une stratégie à l'autre est une réindexation et rien d'autre, et la vérification d'un *get* est la même | ne plus l'écrire sous `index` : rien ne le lit là que cette vérification |
| L'id d'un document sous `attribute` | `<tenant>:<key>` | l'unicité de `_id` ne tient que par *shard* dès qu'un routage est donné ; avec le locataire dans l'id, deux locataires ne partagent jamais un document, quel que soit le nombre de *shards* | la clé seule, avec le refus que les stores SQL opposent à une clé tenue par un autre locataire |
| Un *get* et les écritures sous une élévation | le locataire du travail (`tenantScopeOf`) ; une élévation n'élargit qu'une recherche | une clé nomme une ligne dans un locataire ; un *get* à travers les locataires devrait choisir entre eux | un *get* par `<name>` avec une requête `ids`, si un usage se présente |
| Les noms | `<name>.v<generation>` pour un index, `-` avant le locataire ; un nom de modèle de lecture en `[a-z0-9_]`, un locataire en `[a-z0-9_-]` | avec `<name>-<tenant>-v<generation>` à la place, l'alias du locataire `acme-v1` est l'index d'`acme` et l'alias du locataire `v1` l'index partagé ; un point, qu'aucun id de locataire ne tient, ferme cela | les noms sont écrits dans une classe (`IndexNames`) : un autre schéma est une réindexation |
| Un locataire avec des majuscules | refusé (`InvalidIndexNameError`) | un nom d'index est en minuscules ; replier ferait d'`Acme` et `acme` un seul locataire | un encodage réversible des majuscules, si un projet en a besoin |
| Créer des index | jamais à une écriture : `require_alias=true`, et `provision(tenant)` ou `ensureMapping()` depuis la plateforme | une faute de frappe dans un nom créerait un index, avec un *mapping* deviné depuis le document | un provisionnement à la première écriture, derrière une option |
| La génération | toujours `1`, pas une option | une option sans reconstruction laisserait deux générations tenir l'alias d'un locataire | la reconstruction l'ajoute |
| Le *mapping* | depuis la `CriteriaDefinition` : ses types (`string`, `number`, `boolean`, `instant`, `decimal`), indexés ; les autres champs de la ligne sous `fields`, avec les mêmes types, gardés et non indexés ; `dynamic: 'strict'` | le vocabulaire des critères, pas un second (`keyword`, `text`) à tenir en phase avec lui | `text` et des analyseurs comme extension de la définition, quand la recherche plein texte sera construite |
| Un décimal | gardé tel qu'il a été écrit, comparé par une clé d'ordre dans `_ddd_order.<field>` | aucun type d'OpenSearch ne compare des décimaux de toute longueur sans flottant | `scaled_float` derrière une option, pour un projet qui accepte son arrondi |
| La concurrence | le `_seq_no` et le `_primary_term` du document lu, gardés pour l'estampille que `find` a rendue ; un remplacement donné avec une autre estampille relit le document | une écriture est conditionnée à ce qui a été lu, sans seconde lecture dans le cas courant | rien à défaire : c'est le contrat de `ReadModelRows` |
| Après un conflit | `writeIfNewer` du noyau : cinq tentatives, puis `ConcurrencyError` | la même borne et la même erreur que tout store | rien à défaire |
| Une page par curseur | le filtre par jeu de clés du plan (`plan.seek`), pas `search_after` | le curseur tient les valeurs de la ligne, comme sur les stores SQL ; `search_after` tient celles du moteur (millisecondes depuis l'époque, clés d'ordre) | `search_after` depuis le même curseur, une fois les valeurs du curseur traduites en valeurs de tri |
| Le rafraîchissement | aucun par défaut ; `refresh: 'wait_for'` sur une écriture quand l'option le demande | le côté lecture est cohérent à terme, comme le dit la proposition, et une attente à chaque écriture est un coût qu'un projet choisit ; un *get* est en temps réel | changer le défaut : une ligne, et une phrase du README |
| La reconstruction | pas construite : `rebuilding()` est faux, les étapes refusent avec `UnsupportedRebuildError` | hors du périmètre de ce changement | une version ultérieure remplit `<name>...v2` et déplace les alias en un appel `_aliases` : la génération dans chaque nom d'index et l'alias devant toute lecture sont là pour cela |
| Le contrat | `readModelRowsContract`, la moitié « lignes » de `readModelStoreContract`, ajoutée à `@ddd-ts-kit/testing` | `readModelStoreContract` tient la reconstruction, que ce store n'a pas | le store passe `readModelStoreContract` une fois sa reconstruction écrite |
| La famille | hors de la famille des modèles de lecture de `pipeline/monorepo/families.mjs` | OpenSearch n'est pas un ORM, et la famille compare les options de quatre *packages* d'ORM | une famille des stores de modèle de lecture, si un second moteur vient |
| npm | publié par la release, comme chaque paquet | la release publie par publication de confiance, que npm n'accepte que pour un nom qui existe : le propriétaire a réservé `@ddd-ts-kit/opensearch` par un `0.0.0` déprécié et déclaré son éditeur de confiance (`CONTRIBUTING.md`, « A new package ») ; 0.108.0 l'a livré `private` jusque-là | `"private": true` à nouveau le tient hors de la release suivante ; `npm deprecate` marque les versions publiées |
| La CLI | `init --search opensearch` le câble, depuis que le paquet est sur npm ([ADR-0009](0009-init-wires-opensearch.fr.md)) | un projet généré s'installe depuis npm | `init --search none` |

## Conséquences

Une écriture dans OpenSearch n'est pas dans la transaction de l'unité de travail : la marque
d'événement traité se valide dans la base, le document dans l'index. Une panne entre les deux
livre l'événement à nouveau, et l'estampille rend cette seconde livraison périmée, si bien que rien
n'est appliqué deux fois ; un document écrit dans une unité de travail qui s'annule reste. Le
README du paquet le dit.

Les specs sur un vrai nœud coûtent environ quatre minutes et demie. Le job d'intégration de GitHub ne
démarre OpenSearch que lorsqu'elles tournent : tous les paquets sur le tronc, la nuit et sur une
release, ou une pull request qui atteint `packages/opensearch`. Le pipeline GitLab du kit le démarre
comme service de son job d'intégration, comme ses autres serveurs.

## Quand y revenir

Quand la reconstruction sera construite (le contrat devient `readModelStoreContract`), quand le
paquet sera publié (le câblage d'`init`, fait dans [l'ADR-0009](0009-init-wires-opensearch.fr.md)), quand un projet le fera tourner sur Elasticsearch (les
mêmes specs sur ce serveur), et quand la recherche plein texte sera demandée (le *mapping* des
champs `text`).
