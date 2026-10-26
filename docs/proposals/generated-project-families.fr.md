[English](generated-project-families.md) · **Français**
<!-- translation-of: generated-project-families.md sha256:6ac1bbf2deb62da1 -->

# Proposition : les familles qui génèrent des projets, dans le *pipeline* et sur une station de travail

**Résumé.** Les jobs du *pipeline* qui génèrent des projets et tiennent chacun à sa propre porte
(les quatre *shards* de bout en bout, les projets générés installés pour de vrai sur npm et pnpm,
l'alias d'import à l'exécution, l'application d'exemple et la copie de l'exemple où chaque règle
est enfreinte une fois) ont pris 70 % d'une exécution de *pull request* et 79 % d'une exécution du
tronc le 2026-10-26, et ils grandissent avec les *templates* : les *shards* de bout en bout sont
passés d'environ 2 350 à 3 450 secondes de *runner* en deux jours, le plus long d'environ 740 s à
environ 1 200 s, pendant que les *stacks* exécutables passaient de 43 à 48. Cette page les mesure
depuis l'API et les journaux de 387 exécutions du *pipeline* et sur un projet généré à la fois sur
la station de travail, liste ce qui est généré, installé ou vérifié plus d'une fois, et finit par un
plan de *pull requests* dans l'ordre du gain par effort. La version courte : un job hors de ces
familles, la lecture de mutation d'une *pull request*, faisait une exécution complète de Stryker
sur chaque *pull request* parce que le rapport qu'il devait réutiliser n'était jamais écrit
(corrigé sur cette branche, une ligne) ; la sélection par *stack* de #260 n'a jamais réduit une
exécution (104 des 104 *pull requests* qui intègrent tous les *packages* ont exécuté toutes les
*stacks*) ; les deux balayages d'`init` seul sur les 48 *stacks* exécutables font un tiers du temps
de bout en bout ; les *stacks* éprouvées sont générées et installées deux fois ; et les *shards*
sont équilibrés sur des chiffres du 2026-10-23 qui ont doublé. Une exécution de *pull request* peut
passer d'environ 7 700 à environ 4 700 secondes de *runner* et son temps de mur de 28 à environ 16
minutes, si le mainteneur accepte ce qu'une *pull request* prouverait alors et ce qu'elle
laisserait au tronc et à la nuit ([décisions](#ce-quune-pull-request-doit-encore-prouver)).

## État (2026-10-26)

**Étudié ; une ligne construite.** L'[étude du 2026-10-23](build-and-test-velocity.fr.md) a déjà
replié des jobs, réduit les familles d'une *pull request*, coupé l'exécution de l'alias et
équilibré les *shards* ; sa section sur les outils de l'oxc-project (*pull request* #410) a trouvé
qu'environ 6 300 des 8 300 secondes de *runner* d'une exécution du tronc vont à ces familles, et
qu'un *linter* plus rapide en économiserait au plus 3 %. Cette page prend ces familles pour sujet.
Le seul changement qu'elle fait est la ligne du [premier levier](#1-la-lecture-de-mutation-lit-le-rapport-de-la-nuit),
dans un *commit* à part ; chaque autre levier est une *pull request* du [plan](#le-plan).

**Décidé et construit (2026-10-26).** Le mainteneur a retenu les leviers 3, 4, 6, 7 et 8, avec les
choix listés sous [ce qu'une *pull request* doit encore
prouver](#décidé-le-2026-10-26-et-construit) ; ce sont quatre *commits* de `fix/families-decided`.

## La question

Que coûtent les familles qui génèrent des projets, par exécution et par jour, sur une *pull
request*, sur le tronc et la nuit ; qu'y fait-on plus d'une fois ; qu'est-ce qu'une *pull request*
peut sauter ou laisser au tronc et à la nuit sans perdre ce qu'elle doit prouver ; et qu'est-ce qui
garde en vie une station de travail partagée par plusieurs agents pendant qu'elle les exécute ?

## Méthode

Les indicateurs sont ceux de la [page sur la vélocité](build-and-test-velocity.fr.md#méthode-et-indicateurs) :
temps de mur, temps CPU, pic de mémoire de l'arbre de processus, temps de file, taux de sélection.

- **Le *pipeline*.** L'API de GitHub Actions pour les 387 exécutions terminées du *workflow* CI du
  2026-10-24 au 2026-10-26 (285 de *pull requests*, 100 du tronc, 3 nuits et une exécution à la
  demande) : chaque job avec sa durée (`completed_at` moins `started_at`), sa file (`started_at`
  moins `created_at`) et ses étapes. Les tableaux d'aujourd'hui sont les exécutions réussies du
  2026-10-26 (35 de *pull requests*, 17 du tronc, une nuit), parce que les familles ont grandi
  pendant les trois jours ([Croissance](#croissance)). Les durées par fichier viennent des
  journaux des quatre *shards* et des autres familles dans 16 exécutions du 2026-10-26 (8 du tronc,
  8 de *pull requests*) et d'une exécution du tronc du 2026-10-24. *Runners* : `ubuntu-26.04`,
  4 vCPU.
- **Les *pull requests*.** Les 120 *pull requests* fusionnées du 2026-10-23 17:22 au 2026-10-26
  14:38, leurs fichiers passés par `select` de `pipeline/monorepo/affected-packages.mjs` et par la
  règle de `reachedBy` dans `packages/cli/test/e2e/stacks.ts`, pour voir ce que fait la sélection
  sur de vrais changements.
- **La station de travail.** 20 cœurs, 32 Go, Node 24.22.1, npm 11.19.1, les *packages*
  construits. Un projet généré à la fois, chaque commande sous `nice -n 10`, son temps de mur, son
  temps CPU (utilisateur et système, `/usr/bin/time`) et la mémoire résidente de son arbre de
  processus additionnée toutes les 200 ms ; la charge moyenne de la dernière minute relevée avant
  chaque commande (1,2 à 11,9 : d'autres agents partageaient la machine). Le projet est celui que
  fait `initAloneIsGreen` (la *stack* par défaut, deux contextes demandés à `init`, le kit copié
  comme le fait `installAsPublished`), ses étapes exécutées comme l'aide les exécute, puis un
  projet installé pour de vrai sur npm comme le fait `installForReal`, avec un cache de npm vide
  puis chaud. Aucune suite de *specs* n'a été exécutée entière. Les chiffres bruts sont dans
  [generated-project-families.csv](generated-project-families.csv).

## Ce que les familles coûtent aujourd'hui

### Par exécution

Secondes de *runner* médianes de chaque job dans les exécutions réussies du 2026-10-26 :

| Job | *Pull request* | Tronc | Nuit |
|---|---|---|---|
| Tests de bout en bout, *shard* 1, 2, 3, 4 | 593, 758, **1 195**, 968 | 564, 738, **1 191**, 984 | 415, 902, 1 234, 731 |
| Projet généré sur npm | 784 | 748 | 988 |
| Projet généré sur pnpm | non exécuté (la *release* seule) | 566 | 703 |
| Alias d'import à l'exécution, Node 24 / Node 22 | 521 / non exécuté | 511 / 461 | 530 / 438 |
| Application d'exemple | 400 | 393 | 322 |
| Chaque règle enfreinte une fois dans une copie de l'exemple | 171 | 173 | 173 |
| *Stacks* par paires, premières migrations sur PostgreSQL | non exécutés (la *release* seule) | non exécutés | 118, 199 |
| **Les familles ensemble** | **5 390 (70 %)** | **6 329 (79 %)** | environ 6 800 |
| Score de mutation du changement, sur l'exemple | **1 133** | non exécuté | |
| Tests unitaires, Node 24 avec couverture / Node 22 | 451 / 356 | 720 / 627 | 764 / 547 |
| Les autres jobs (installation, contrôles, lint, architecture, intégration, sécurité, l'envoi à Codecov, l'essai d'Oxlint) | environ 460 | environ 750 | environ 720 |
| **Une exécution entière** (médiane des exécutions, pas la somme des médianes) | **7 685** | **8 023** | 11 747 (avec l'exécution de mutation de la nuit, 1 448, et les essais arm64, 1 513) |

Lecture : sur une *pull request* les familles font 70 % de l'exécution et la lecture de mutation
15 % de plus ; sur le tronc les familles font 79 %, deux de leurs jobs (pnpm, l'alias sur Node 22)
ne tournant que là. Chaque job de famille passe 17 à 20 s à sa préparation (*checkout*, les
dépendances et le build restaurés depuis leurs caches) ; le reste est l'exécution des *specs*.

### Sur trois jours

Les 387 exécutions ont pris 638 heures de *runner*, 213 par jour, pour une limite de 20 jobs à la
fois :

| Où | Heures de *runner* | Part |
|---|---|---|
| *Shards* de bout en bout | 254 | 40 % |
| Projets générés sur npm et pnpm | 69 | 11 % |
| Alias d'import à l'exécution | 54 | 8 % |
| Application d'exemple, copie de l'exemple | 34, 15 | 5 %, 2 % |
| **Les familles** | **426** | **67 %** |
| Lecture de mutation des *pull requests* | 62 | 10 % |
| Tests unitaires, les deux lignes de Node | 87 | 14 % |
| Tout le reste | 63 | 9 % |
| ... dont exécutions de *pull request* réussies, annulées, en échec | 309, 98, 50 | 48 %, 15 %, 8 % |
| ... dont exécutions du tronc, de la nuit | 171, 11 | 27 %, 2 % |

Lecture : un changement fusionné coûte environ 2,5 exécutions de sa *pull request* et une
exécution du tronc. Les **83 exécutions de *pull request* annulées** (un *push* plus récent sur la
même *pull request*) ont vécu une médiane de 637 s, assez pour que les familles démarrent : elles
ont brûlé 61 heures de *runner* de familles, 10 % de tout, sans verdict. Les 100 exécutions du
tronc (44 d'entre elles démarrées moins de 25 minutes après la précédente) coûtent 15 fois ce que
coûtent les nuits.

### Le chemin critique d'une *pull request*

Le 2026-10-26 une exécution réussie de *pull request* a pris une médiane de **1 672 s** de sa
création à son dernier job (p95 3 065 s). Le dernier *shard* s'est terminé à une médiane de
1 499 s, la lecture de mutation à 1 542 s : sur les trois jours, la lecture de mutation a été le
dernier job de 88 des 160 exécutions réussies de *pull request*, la porte le dernier des autres.
Le job d'installation prend 32 s ; chaque job de famille a ensuite attendu une médiane de 60 à
260 s dans la file (p95 de 760 à 1 900 s en ce jour chargé) avant ses 17 s de préparation. Sur les
63 heures observées, 18 jobs ou plus ont tourné 33 % du temps et 20, la limite du forfait, 17 % du
temps (les nuits comprises, quand rien ne tourne).

Deux jobs fixent donc aujourd'hui le temps de mur d'une *pull request*, chacun à environ 25
minutes de la création de l'exécution : le troisième *shard* (1 195 s d'exécution) et la lecture
de mutation (1 133 s). En raccourcir un seul déplace peu la médiane.

### Croissance

| Exécution du tronc | *Stacks* exécutables | Secondes par *stack* d'`init` seul | Les quatre *shards* | *Shard* le plus long |
|---|---|---|---|---|
| 2026-10-24 00:18 | 43 | 7,4 (sans contexte), 8,7 (deux contextes) | 2 328 | 743 s |
| 2026-10-26, 16 exécutions | 48 | 13,8 | 3 450 | 1 194 s (médiane) |

Lecture : en deux jours les *stacks* ont augmenté de 12 % et le coût de chacune de 60 à 90 %, à
mesure que les *templates* grandissaient (procédures, contrôleurs Nest, Passport, l'audit en ajout
seul, les jobs de la plateforme). Les familles suivent le nombre de *stacks* fois la taille d'un
projet généré ; un facteur constant gagné sur un outil est mangé en quelques jours, une sélection
ne l'est pas.

### Par fichier de *spec*

Médianes des 16 exécutions du 2026-10-26, en secondes de *runner* (les fichiers d'un *shard*
s'exécutent l'un après l'autre ; les autres familles exécutent deux fichiers à la fois) :

| Fichier de *spec* | Famille | Médiane | Ce qu'il fait |
|---|---|---|---|
| `first-minute-no-context.spec.ts` | *shard* 4 | **664** | `init` seul sur les 48 *stacks* exécutables, installé comme publié, toute la porte |
| `first-minute-two-contexts.spec.ts` | *shard* 3 | **661** | la même chose avec deux contextes demandés à `init` |
| `coverage-gate.spec.ts` | *shard* 2 | 519 | les 9 *stacks* éprouvées et la *stack* de l'exemple, chaque sorte générée, installées, les *specs* exécutées quatre fois avec couverture |
| `first-minute-proven.spec.ts` | npm, pnpm | 411 | 8 *stacks* éprouvées installées pour de vrai, `verify` quatre fois chacune |
| `proven-stacks.spec.ts` | *shard* 1 | 362 | les 9 *stacks* éprouvées, chaque sorte générée, installées, toute la porte |
| `alias-runtime.spec.ts`, `alias-runtime-second-half.spec.ts` | alias | 351, 326 | 57 cas générés, compilés, démarrés sous node, tsx et vitest |
| `preset-identity.spec.ts` | *shard* 3 | 303 | 6 variantes du *preset* identity |
| `package-managers.spec.ts`, `first-minute.spec.ts`, `first-minute-js.spec.ts` | npm, pnpm | 224, 216, 135 | installations pour de vrai, le démarrage rapide du README |
| `first-class.spec.ts` | *shard* 4 | 208 | la *stack* de l'exemple sur trois *brokers* |
| `typecheck.spec.ts` | *shard* 2 | 130 | chaque *stack* générée et vérifiée en types contre les sources |
| `rpc-procedures.spec.ts` | *shard* 2 | 122 | oRPC et tRPC sur les quatre serveurs et Nest |
| `zero-violation.spec.ts`, `formatted.spec.ts` | *shards* 2, 4 | 57, 56 | chaque *stack* générée, contrôlée, formatée ; **exécutés aussi par les deux jobs unitaires** |
| les 20 autres fichiers | | 2 à 74 chacun, 527 ensemble | |

Le tableau de `pipeline/monorepo/e2e-shards.mjs` porte encore les secondes du 2026-10-23
(`first-minute-two-contexts` à 322, `first-minute-no-context` à 312, `coverage-gate` à 328) : les
*shards* finissent maintenant à 477, 875, 1 194 et 961 s d'exécution des *specs*, le troisième à
2,5 fois le premier.

### Un projet généré, étape par étape

Le projet d'`initAloneIsGreen` (la *stack* par défaut, deux contextes), deux fois :

| Étape | Mur | CPU | Pic de mémoire de l'arbre |
|---|---|---|---|
| `init` | 0,34 à 0,39 s | 0,4 s | 0,09 Go |
| le kit copié (`installAsPublished`, 85 Mo par projet) | 0,29 à 0,31 s | 0,3 s | 0,06 Go |
| `eslint --print-config`, `check --json`, `depcruise-config --check` | 1,2 s ensemble | 1,7 s | 0,20 Go |
| **ESLint, sans cache** | **3,04 à 3,05 s** | **6,2 s** | 0,63 Go |
| dependency-cruiser | 0,46 à 0,62 s | 0,6 s | 0,17 Go |
| knip, puis knip de nouveau pour ses remarques | 0,54 à 0,66 s, puis 0,45 à 0,47 s | 1,4 s | 0,16 Go |
| **les *specs* (Vitest, la moitié des cœurs)** | **2,32 à 2,36 s** | **5,0 s** | **1,01 à 1,13 Go** |
| le compilateur, `build-aliases`, `docs --check`, les contrôles des événements et d'OpenAPI | 1,4 s ensemble | 2,6 s | 0,25 Go |
| **le projet** | **10,2 à 10,6 s** | **18,5 s** | **1,1 Go** |

Un projet installé pour de vrai sur npm, la *stack* par défaut, le kit depuis ses archives :

| Étape | Mur | CPU | Pic de mémoire |
|---|---|---|---|
| `npm pack` des 26 *packages*, l'un après l'autre (`packedKit`, une fois par fichier de *spec*) | 12,4 s | 16,8 s | 0,23 Go |
| `npm install`, cache de npm vide (816 Mo y sont téléchargés) | 145,5 s | 36,0 s | 0,53 Go |
| `npm install`, cache chaud | 10,7 s | 19,1 s | 1,19 Go |
| `npm ci` juste après (`installForReal` fait les deux) | 7,6 à 8,2 s | 11,1 à 12,5 s | 1,0 à 1,07 Go |
| `npm run verify` | 10,5 à 13,3 s | 20,2 à 22,7 s | 1,19 à 1,37 Go |

Lecture : un ESLint à froid fait 29 % du mur et 33 % du CPU d'un projet, les *specs* 22 et 27 % ;
le reste est une douzaine de processus courts. Un *runner* met environ 1,3 fois ces secondes
(13,8 s par *stack* contre 10,4 s). La seconde installation de chaque projet réel, `npm ci`, fait
un quart de son coût sur un cache chaud ; l'empaquetage du kit, refait par chacun des quatre
fichiers de *spec* du job, coûte plus qu'une installation. Le cache vide est ce que rencontre le
premier projet d'un *runner* ; le lien de cette station de travail vers le *registry* est plus lent
que celui d'un *runner*, donc les 145 s sont une borne haute.

## Ce qui est fait plus d'une fois

- **Les *stacks* éprouvées, deux fois.** `proven-stacks.spec.ts` et `coverage-gate.spec.ts`
  génèrent chacun chaque sorte sur les mêmes 9 *stacks* et copient le kit dans chacune
  (`scaffoldEverything` puis `installAsPublished`) ; le premier exécute les *specs* une fois, le
  second quatre fois avec couverture (`test:coverage`, `ci:test:unit`, `ci:test:integration`, puis
  de nouveau avec une *spec* retirée). 881 s d'une exécution, dont une génération et deux
  exécutions des *specs* par *stack* sont des répétitions.
- **La matrice des *stacks*, huit fois par exécution du tronc.** `zero-violation`, `formatted` et
  `typecheck` génèrent chacune des 54 *stacks*, chacun de son côté ; les exécutions de l'alias
  génèrent 57 cas sur chaque ligne de Node ; les deux balayages `first-minute` exécutent `init` sur
  48 d'entre elles. Avec les deux jobs unitaires, qui exécutent aussi `zero-violation` et
  `formatted`, une exécution du tronc génère la matrice une dizaine de fois. Générer coûte peu
  (moins d'une seconde par *stack*) ; ce qui est répété à un coût, c'est la porte exécutée sur
  chacune, et `zero-violation` et `formatted` sont les mêmes fichiers dans les jobs unitaires et
  dans les *shards* (113 s de *shards*, plus leur part de chaque job unitaire).
- **knip deux fois par projet d'`init` seul** (`expectNoFinding`, puis de nouveau pour ses
  remarques) : 0,5 s sur 10,4, 96 projets par exécution.
- **L'empaquetage du kit**, une fois par fichier de *spec* du job *managers* au lieu d'une fois par
  job : quatre fois 12 s ici, plus sur un *runner*.
- **Deux installations par projet réel** : `npm install` écrit le *lockfile*, `npm ci` prouve qu'un
  *pipeline* l'accepte. Cette preuve revient à `package-managers.spec.ts` ; les fichiers
  *first-minute* la répètent sur chaque projet.
- **`verify` quatre fois sur chaque projet *first-minute***, après `init`, après chaque contexte et
  après le premier cas d'usage : 16 exécutions de toute la porte dans le job npm d'une *pull
  request*, chacune ne réinstallant rien mais lintant, testant et contrôlant tout le projet.
- **L'exécution complète de Stryker sur l'exemple à chaque *pull request*** (la section suivante).
- **Le même *commit*, deux fois.** Une *pull request* fusionnée est exécutée de nouveau sur le
  tronc, en entier, avec les deux jobs qu'une *pull request* n'exécute pas ; une *pull request*
  dont un *push* plus récent annule l'exécution paie les familles des deux.

## Les leviers

Chaque levier ci-dessous donne son gain en secondes de *runner* d'une exécution de *pull request*
et d'une exécution du tronc, son effet sur le temps de mur d'une *pull request*, sur la station de
travail quand il s'y applique, et son risque : ce qu'une *pull request* ne prouverait plus avant sa
fusion. Les chiffres marqués « estimé » sont déduits des médianes par fichier et par étape
ci-dessus, pas mesurés après le changement.

### 1. La lecture de mutation lit le rapport de la nuit

**Ce qui se passe.** Le job « Mutation score of the change, on the example » (*pull request* #278)
télécharge l'artefact de la dernière nuit et exécute Stryker avec `DDD_TS_KIT_MUTATION_SINCE`, qui
active son mode incrémental avec `reports/mutation/incremental.json`. La nuit s'exécute sans cette
variable, donc le mode incrémental est éteint et Stryker n'écrit jamais ce fichier : l'artefact ne
contient que `index.html` et `mutation.json`, et chaque *pull request* depuis le 2026-10-24 a
journalisé « No incremental result file found ..., a full mutation testing run will be
performed » : 2 412 mutants, 22 minutes 46 s sur #406, une *pull request* qui ne touchait aucun
fichier de l'exemple.

**La correction.** Le rapport json et le fichier incrémental sont le même objet (tous deux sont le
rapport que Stryker remet à ses *reporters*, `onMutationTestReportReady`). Copié vers
`incremental.json` avant l'exécution, le `mutation.json` de la nuit a été relu sur la station de
travail : « 2012 of 2412 mutant result(s) are reused » (les 400 autres sont les mutants statiques
et les textes de refus que la configuration écarte), l'exécution a passé son temps dans l'exécution
à blanc des 1 121 tests, 70 à 128 s à la concurrence d'un *runner*. Sur un *runner* l'exécution à
blanc des 1 121 tests a pris 112 s.

**Gain.** Environ 990 secondes de *runner* par exécution de *pull request* (de 1 133 s à environ
140 s), 13 % de celle-ci ; la lecture de mutation cesse d'être la moitié du chemin critique.
**Construit sur cette branche** : une ligne de `.github/workflows/ci.yml`, dans son propre
*commit*. Le même manque est livré à chaque projet qu'écrit `init` (les jobs de mutation de
`templates/pipeline/github/workflows/ci.yml.tpl` et du *template* GitLab), où la correction
revient à `governedMutation` de `@ddd-ts-kit/testing` ou aux *templates* : la première *pull
request* du plan. Sauter le job quand le changement ne touche aucun fichier de l'exemple
économiserait les 140 s restantes sur la plupart des *pull requests*.

**Risque.** Aucun : le plancher est celui de la nuit, la lecture reste une lecture.

### 2. Les *shards* équilibrés sur les secondes d'aujourd'hui, les deux balayages coupés

Le tableau des *shards* date du 2026-10-23 et ses deux plus gros fichiers ont doublé depuis.
Équilibrés sur les médianes ci-dessus, avec `first-minute-no-context` et
`first-minute-two-contexts` coupés chacun en deux moitiés comme l'a été `alias-runtime` (une
*stack* sur deux), les quatre *shards* tiennent environ 875 s chacun.

**Gain.** Environ 320 s de temps de mur sur chaque exécution de *pull request* et du tronc (le
troisième *shard*, de 1 195 s à environ 875 s), aucune seconde de *runner*. Un script qui écrit le
tableau depuis le *reporter* json de la dernière exécution du tronc (ou qui avertit quand un *shard*
dérive de plus d'un cinquième) l'empêche de dériver de nouveau. **Risque :** aucun.

### 3. Un ensemble couvrant de *stacks* sur une *pull request*, toutes les *stacks* sur le tronc et la nuit

La sélection par *stack* de #260 garde une *stack* quand un de ses indicateurs nomme un *package*
que le changement atteint, et toutes les *stacks* quand un *package* avec lequel chaque projet est
construit est atteint. Sur les 113 *pull requests* des trois jours (les *releases* à part) : 9 ne
changeaient que des documents ; **104 atteignaient `cli` ou un autre *package* de cette liste et
ont exécuté toutes les *stacks*** ; aucune n'a été réduite. `pipeline/`, `plugin/`, `docs/` et
`examples/` comptent comme `cli`, et 63 des 104 touchaient des *templates* ou des générateurs, qui
atteignent bien toutes les *stacks*. Une sélection par chemin ne peut pas faire beaucoup mieux :
seules 6 des 104 ne touchaient rien de ce dont un projet généré est fait.

Une sélection par valeur le peut. Sur les 21 indicateurs des 48 *stacks* exécutables, une
couverture gloutonne garde **16 *stacks* où chaque valeur de chaque indicateur apparaît au moins
une fois**. Sur une *pull request*, les deux balayages d'`init` seul et les cas de l'alias
s'exécutent sur ces 16 (plus les trois écritures avec `.js`) ; le tronc et la nuit gardent les 48
et les 57, et le job des paires garde les paires la nuit.

**Gain (estimé).** Les deux balayages de 1 325 s à environ 440 s, le job de l'alias de 521 s à
environ 230 s : environ 1 180 secondes de *runner* par exécution de *pull request*, et le chemin
critique des *shards* avec. **Risque :** une casse que seule une combinaison de deux valeurs montre
(un *broker* avec un style de câblage, par exemple) n'est plus vue avant la fusion ; l'exécution du
tronc la voit dans l'heure, sur toutes les *stacks*, et le job des paires la nuit. La couverture est
calculée depuis `EVERY_STACK`, donc une nouvelle valeur est couverte le jour où elle arrive.

### 4. Les *stacks* éprouvées générées une fois

`proven-stacks` et `coverage-gate` fusionnés en un fichier : un projet par *stack* éprouvée, dont
l'exécution des *specs* est `test:coverage` (une exécution prouve que les *specs* passent et que
chaque couche atteint son plancher), puis le reste de la porte éprouvée. Les deux exécutions du
découpage du *pipeline* (`ci:test:unit`, `ci:test:integration`) et l'exécution avec une *spec*
retirée restent sur une *stack* sur une *pull request*, sur toutes les *stacks* sur le tronc et la
nuit.

**Gain (estimé).** Environ 400 secondes de *runner* par exécution de *pull request* (des 881 s des
deux fichiers à environ 480 s), environ 300 par exécution du tronc. **Risque :** sur une *pull
request*, les exécutions découpées du *pipeline* sont prouvées sur une *stack*, pas dix.

### 5. Chaque *spec* qui génère dans une seule famille

`zero-violation.spec.ts` et `formatted.spec.ts` s'exécutent dans les deux jobs unitaires et dans
les *shards*. Un endroit suffit. Hors de la suite unitaire, ils quittent le *hook* de pré-*push* de
chaque branche qui atteint `cli` (la plupart) : mesurés sur la station de travail sous une charge
de 9 à 12, 49 s et 57 s de mur, 54 et 64 secondes CPU, 1,3 et 0,9 Go. Hors des *shards* à la
place, les *shards* perdent 113 s.

**Gain.** Soit environ 113 secondes de *runner* par exécution, soit une part de chaque job unitaire
(ce sont ses deux plus longs fichiers après la matrice de compilation) et 118 secondes CPU de chaque
*push* local. **Risque :** aucun si les jobs unitaires les gardent sur une *pull request* qui
atteint `cli` ; le mainteneur choisit où vit la garantie d'homogénéité.

### 6. Les installations réelles, plus légères

Dans le job *managers* : le kit empaqueté une fois par job (une étape avant les *specs*, le dossier
passé par une variable d'environnement que lit `packedKit`) au lieu d'une fois par fichier de
*spec* ; `npm ci` après `npm install` seulement dans `package-managers.spec.ts`, qui est la preuve
de l'installation figée ; sur une *pull request*, les projets *first-minute* tenus à `verify` après
`init` et après leur premier cas d'usage, les deux exécutions intermédiaires (après chaque contexte)
laissées au tronc et à la nuit.

**Gain (estimé).** Le job npm de 784 s à environ 500 s par exécution de *pull request* (trois
empaquetages d'environ 25 s, sept `npm ci` d'environ 15 s, huit `verify` d'environ 20 s) ; la même
proportion sur pnpm. **Risque :** un projet rouge entre son premier contexte et son premier cas
d'usage est vu à l'exécution du tronc, pas avant la fusion. La séquence a été ajoutée pour un défaut
signalé : le mainteneur décide.

### 7. Le tronc garde ce qu'exécute une *pull request* ; la nuit garde le reste

Le tronc exécute pnpm (566 s) et l'alias sur Node 22 (461 s), qu'aucune *pull request* n'exécute,
à chacune de ses 25 exécutions réussies par jour. La nuit et sur la *pull request* d'une *release*,
ils prouvent toujours les deux.

**Gain.** Environ 1 030 secondes de *runner* par exécution du tronc (13 %), 7 heures de *runner*
par jour au trafic des trois jours, et deux jobs de moins contre la limite de 20 à chaque fusion.
**Risque :** une casse sur pnpm ou sur Node 22 est vue à 03:00 au lieu de dans l'heure, et toujours
avant toute *release* ; le job de l'alias rejoint la condition de la *pull request* de *release*
que pnpm a déjà.

### 8. Aucune famille sur une *pull request* en brouillon

Les 83 exécutions annulées ont brûlé 61 heures de *runner* de familles en trois jours, un *push*
plus récent arrivant une médiane de dix minutes après le démarrage de l'exécution. Les familles (et
la lecture de mutation) sautent une *pull request* en brouillon
(`github.event.pull_request.draft == false`, et `ready_for_review` parmi les événements de
`pull_request`) ; un agent ouvre sa *pull request* en brouillon jusqu'à ce que sa branche soit
finie.

**Gain.** Jusqu'à 20 heures de *runner* par jour au trafic des trois jours, et la file qu'elles
causaient. **Risque :** aucun pour ce qui est fusionné (une *pull request* quitte son brouillon,
puis exécute tout) ; une exécution de plus quand un agent oublie le brouillon. Cela demande que les
consignes des agents le disent.

### 9. La station de travail

Ce que prend un projet généré est peu (1,1 Go à son pic, Vitest sur la moitié de 20 cœurs) ; ce qui
redémarre un bureau, ce sont plusieurs exécutions lourdes à la fois : le *hook* de pré-*push* d'une
branche qui atteint tout (6,8 à 7,3 Go, [page sur la vélocité](build-and-test-velocity.fr.md#ce-que-la-journée-a-mesuré)),
une exécution de famille (deux fichiers à la fois, environ 2,5 Go), une exécution de Stryker
(2,6 Go à la concurrence 4, le double à la concurrence par défaut de 19 ici), venant de plusieurs
agents.

- Un verrou pour la machine autour des commandes lourdes hors d'un *pipeline* (`flock` sur un
  fichier du répertoire d'exécution de l'utilisateur, deux détenteurs au plus) : l'étape unitaire
  du *hook* de pré-*push*, les scripts `ci:test:*` et `test:mutation`. Un agent qui trouve les deux
  places prises attend au lieu d'ajouter 7 Go.
- `VITEST_MAX_WORKERS=2` dans les scripts des familles de bout en bout hors d'un *pipeline*, comme
  les scripts *managers* et de l'alias le fixent déjà : les projets qu'ils génèrent démarrent alors
  deux *workers*, pas dix.
- Le levier 5 retire deux minutes de CPU à chaque *push* qui atteint `cli`.

**Gain.** Une borne sur le pic de mémoire qu'atteignent ensemble les tests de plusieurs agents, pas
une exécution plus courte. **Risque :** un agent attend le verrou.

### Pas maintenant

- **Un cache chaud de npm ou du *store* de pnpm restauré sur le *runner*.** La première
  installation d'un job télécharge ce que nomment les *templates* (816 Mo de cache ici) ; les
  autres trouvent le cache local. Les 145 s mesurées sont le lien d'une station de travail, pas
  d'un *runner* ; à mesurer dans le *pipeline* avant de dépenser 1 Go d'un cache de 10 Go.
- **Des liens physiques au lieu de copies pour le kit dans chaque projet.** 0,3 s et 85 Mo par
  projet ; les 96 projets des deux balayages gardent environ 4 Go sur le disque d'un *runner*
  jusqu'à la fin de leur fichier. Utile si un *runner* manque de nouveau de disque.
- **Un cache du verdict de chaque *stack*, indexé par son contenu.** La clé devrait contenir la
  sortie construite de chaque *package* qu'installe un projet, que presque chaque *pull request*
  change ; les raisons que la page sur la vélocité a données contre les caches distants tiennent.
- **Annuler une exécution du tronc quand la fusion suivante arrive.** 44 % des exécutions du tronc
  démarrent moins de 25 minutes après la précédente, mais chaque *commit* du tronc garde son propre
  verdict ; le levier 7 en est la moitié la moins chère.

## Le plan

Dans l'ordre du gain par effort ; chaque ligne est une *pull request*, mesurée avant et après sur
les indicateurs de cette page (secondes de *runner* par exécution de *pull request* et du tronc,
temps de mur jusqu'au dernier job, file, les secondes par fichier des *shards*) :

| # | *Pull request* | Secondes de *runner* par exécution de *pull request* | Secondes de *runner* par exécution du tronc | Mur d'une *pull request* | Effort | Demande une décision |
|---|---|---|---|---|---|---|
| 1 | La lecture de mutation réutilise le rapport de la nuit : la ligne de cette branche, puis `governedMutation` ou les deux *templates* pour chaque projet généré, avec un fichier de `changes/` | **-990** | 0 | le job de mutation n'est plus le dernier | une ligne construite ; une petite correction du produit | non |
| 2 | Les *shards* équilibrés sur les secondes d'aujourd'hui, les deux balayages d'`init` seul en moitiés, le tableau écrit depuis la dernière exécution du tronc | 0 | 0 | **environ -320 s** | petit | non |
| 3 | Un ensemble couvrant de 16 *stacks* pour les deux balayages et l'exécution de l'alias sur une *pull request* ; toutes les *stacks* sur le tronc, les paires la nuit | **environ -1 180** | 0 | avec 2, les *shards* à environ 600 s | moyen | **oui** |
| 4 | `proven-stacks` et `coverage-gate` fusionnés, le découpage du *pipeline* et la *spec* retirée sur une *stack* sur une *pull request* | environ -400 | environ -300 | compris dans 3 | moyen | **oui** |
| 5 | `zero-violation` et `formatted` dans une seule famille | environ -113 ou une part des deux jobs unitaires | la même chose | petit | petit | **oui**, laquelle |
| 6 | Empaqueter une fois par job, l'installation figée là où elle est la preuve, deux `verify` par projet *first-minute* sur une *pull request* | environ -280 | environ -180 | le job npm à environ 500 s | petit | **oui**, les états intermédiaires |
| 7 | pnpm et l'alias sur Node 22 la nuit et sur la *pull request* de *release*, plus sur le tronc | 0 | **environ -1 030** | la file | une condition chacun | **oui** |
| 8 | Aucune famille sur une *pull request* en brouillon ; les consignes des agents ouvrent des brouillons | jusqu'à 20 heures de *runner* par jour | 0 | la file | petit, et une habitude | **oui** |
| 9 | Un verrou pour les commandes locales lourdes, deux *workers* de Vitest dans les scripts locaux de bout en bout | 0 | 0 | 0 ; la station de travail | petit | non |

Attendu, lignes 1 à 7 ensemble, au trafic du 2026-10-26 : une exécution de *pull request*
d'environ 7 700 à environ **4 700 secondes de *runner*** (-39 %) ; une exécution du tronc
d'environ 8 000 à environ **6 400** (-20 %) ; le temps de mur d'une *pull request* d'une médiane de
1 672 s à environ **950 à 1 050 s** (l'installation, une file médiane, puis le job le plus long,
qui devient le job unitaire sur Node 24 avec couverture, 451 s en médiane et 745 s au p95, le job
npm à environ 500 s, les *shards* à environ 600 s). Les *shards* pourraient alors être trois au
lieu de quatre, un job de moins contre la limite, pour environ 100 s de temps de mur. La file est
l'indicateur à surveiller : moins de secondes de *runner* au même trafic devraient sortir le dépôt
de sa limite la plus grande partie de la journée, ce que seules les exécutions des jours suivants
peuvent dire.

### État du plan

Construit sur `fix/families-quick`, un commit chacun (le gain est le chiffre de la page, pas
encore mesuré après le changement) :

- **Ligne 1, les modèles.** Le job de mutation de la *pull request* ou de la *merge request* que
  `init` écrit (GitHub et GitLab, et les copies de `pipeline/` et de `examples/scheduling`) copie
  le rapport json de la nuit dans `incremental.json` avant de lancer Stryker, comme la CI du kit.
  Attendu : les mêmes -990 secondes de *runner* par exécution pour un projet dont l'exemple a la
  taille de celui-ci, en proportion de ses mutants ; un fichier de `changes/` porte l'étape aux
  projets existants.

- **Ligne 2, les tranches.** La table de `pipeline/monorepo/e2e-shards.mjs` porte les médianes du
  2026-10-26 et les quatre *runners* finissent à 870, 867, 870 et 873 s de specs (ils finissaient
  à 593, 758, 1 195 et 968 s de job). Les deux balayages `first-minute` ne sont **pas** coupés :
  chacun (664 et 661 s) est plus court que la part d'un *runner* (870 s), l'équilibre est le même
  avec ou sans coupure et le *runner* le plus long n'en raccourcit pas. Attendu : la troisième
  tranche, de 1 195 s à environ 900 s de job (la mise en place d'un job s'ajoute aux 873 s de
  specs), environ 300 s de temps écoulé à chaque *pull request* et exécution du tronc, aucune
  seconde de *runner*. La dérive de la table n'est pas encore signalée.

- **Ligne 5, une seule famille.** `zero-violation` et `formatted` restent dans les tranches de
  bout en bout (la garantie d'homogénéité tourne à chaque *pull request* qui atteint `cli`, là où
  sont déjà les contrôles lourds) et quittent la suite unitaire (`describe.runIf(SLOW)`, comme les
  autres specs de `test/e2e`) : les deux jobs unitaires et le *hook* `pre-push` ne génèrent plus la
  matrice. Mesuré sur la station : 49 s et 57 s de temps écoulé, 118 secondes de CPU et 1,3 Go par
  *push* qui atteint `cli`. Attendu : environ 57 s en moins par job unitaire (les fichiers les plus
  longs après la matrice de compilation), environ 113 secondes de *runner* en moins par
  *pull request* et autant par exécution du tronc, aucun coût dans les tranches. La couverture
  unitaire de `cli` passait de deux lignes sous son plancher de 98 pour cent (97,99 contre 98,00) :
  deux specs unitaires la tiennent désormais (un enregistrement sans exigence ; `--tenant-scoped`
  sur un stockage personnalisé).

- **Ligne 9, la station de travail.** `pipeline/monorepo/heavy-lock.sh` tient l'une de deux
  places pour toute la machine (`flock` sur des fichiers de `$XDG_RUNTIME_DIR`) autour des
  scripts `ci:test:*` et de l'étape unitaire du *hook* `pre-push` ; une exécution de Stryker y
  passe à la main (CONTRIBUTING.md). Les scripts de bout en bout démarrent `VITEST_MAX_WORKERS=2`
  hors d'un *pipeline* (`ci:test:e2e` et le script des tranches désormais ; ceux des
  gestionnaires, de l'alias, des paires et de la nuit le faisaient déjà). Aucun gain de temps : une
  borne sur la mémoire de crête de plusieurs sessions ensemble, deux exécutions lourdes (environ
  7 Go chacune) au lieu d'autant que de sessions. Un agent qui trouve les deux places prises attend
  et le dit.

## Ce qu'une *pull request* doit encore prouver

Les leviers qui demandent une décision échangent une preuve avant la fusion contre une preuve dans
l'heure (le tronc) ou au matin (la nuit). Le mainteneur décide, ligne par ligne :

1. **Chaque valeur de chaque indicateur, ou chaque *stack* ?** Avec le levier 3 une *pull request*
   prouve qu'`init` seul est vert et que l'alias tourne sur un ensemble de *stacks* où chaque valeur
   apparaît ; une casse d'une combinaison est trouvée par l'exécution du tronc de sa fusion.
2. **Les états intermédiaires de la première minute.** Avec le levier 6 une *pull request* prouve
   la première minute (`init` et l'installation) et le premier cas d'usage ; l'état avec un
   contexte, puis deux, est prouvé par le tronc et la nuit.
3. **Les exécutions découpées de la porte de couverture**, sur une *stack* avant la fusion, sur dix
   après.
4. **pnpm et Node 22**, hors du tronc : prouvés la nuit et avant chaque *release*.
5. **Les brouillons** : si les *pull requests* des agents commencent en brouillon, et si un
   brouillon exécute quelque chose au-delà des contrôles statiques, du lint et des *specs*
   unitaires.
6. **Où s'exécute la garantie d'homogénéité** : `zero-violation` et `formatted` dans la suite
   unitaire (chaque *push* d'un portable) ou dans les *shards* de bout en bout (chaque *pull
   request*).

Ce qu'une *pull request* garde dans tous les cas : toute la porte des 9 *stacks* éprouvées,
l'installation réelle de la *stack* par défaut et de la lourde sur npm, le démarrage rapide du
README tapé tel qu'il est écrit, l'exemple et chaque règle enfreinte dans sa copie, chaque *stack*
générée, contrôlée, formatée et vérifiée en types.

### Décidé le 2026-10-26, et construit

Le mainteneur a décidé quatre choses ; chacune est un *commit* de `fix/families-decided`, avec le
gain que les chiffres de cette page lui donnent (estimé depuis les médianes par fichier et par
étape, à relire sur les premières exécutions) :

1. **Un ensemble couvrant de 16 *stacks* sur une *pull request* qui touche un *template* ou un
   générateur, toutes les *stacks* sur le tronc, les paires la nuit.** La sélection par *stack* de
   #260 lisait les *packages* qu'un changement atteint, et toute *pull request* atteignait `cli`.
   Le job d'installation dit maintenant `stacks` : `none` quand aucun *template*
   (`packages/*/templates/`), générateur (`packages/cli/src/`), manifeste de *package*, *spec* de
   bout en bout ni fichier qui les exécute (`ci.yml`, les *shards*, l'empaquetage du kit) n'a
   changé, `cover` quand l'un d'eux a changé, `all` sur le tronc, la nuit et sur la *pull request*
   d'une *release* (titre `chore(release)` ou branche `release/*`). `none` saute les *shards*, les
   exécutions de l'alias et le job des gestionnaires ; `cover` donne aux deux balayages d'`init`
   seul et aux cas de l'alias les 16 *stacks* où chaque valeur de chaque drapeau apparaît
   (`coverOf` dans `packages/cli/test/e2e/stacks.ts`, calculé depuis `EVERY_STACK` : 16 des 48
   *stacks* exécutables et des 55 *stacks*). `zero-violation`, `formatted` et `typecheck` gardent
   toutes les *stacks* sur une *pull request* qui génère : elles coûtent 57, 56 et 130 s.
   **Gain :** environ 1 180 secondes de *runner* pour une *pull request* qui touche un *template*
   ou un générateur, environ 4 800 pour une qui n'en touche aucun (*shards* 3 514, gestionnaires
   784, alias 521) ; au trafic du 2026-10-26, où 63 *pull requests* sur 104 en touchaient un,
   environ 2 600 par exécution de *pull request*. Tronc : 0.
2. **À la nuit, et à la *pull request* d'une *release* : pnpm, les exécutions de l'alias sur
   Node 22, les états intermédiaires de la première minute, la porte de couverture sur ses dix
   *stacks*.** Le job d'installation dit `deep` pour la nuit, une exécution à la demande et une
   *release*, et pour aucune autre. Ailleurs, le tronc compris, le job des gestionnaires installe
   sur npm, l'alias s'exécute sur Node 24, un projet de la première minute lance `verify` avant
   tout contexte et après son premier cas d'usage (pas après un contexte, puis deux), et la porte
   de couverture s'exécute sur la *stack* par défaut. **Gain :** une exécution du tronc environ
   1 800 secondes de *runner* (pnpm 566, alias sur Node 22 461, porte de couverture sur une
   *stack* environ 465, une vingtaine de `verify` intermédiaires environ 300) et deux jobs de
   moins contre la limite de 20 ; une exécution de *pull request* environ 770 ; le troisième
   *shard*, le plus long, d'environ 1 195 s à environ 730 s.
3. **Une *pull request* en brouillon n'exécute que les vérifications rapides ; la marquer prête
   exécute toute la CI.** Les *shards*, les exécutions de l'alias, le job des gestionnaires,
   l'exemple, la copie de l'exemple et la lecture de mutation sautent un brouillon
   (`pull_request` liste `ready_for_review`). Le job `gate` lit les sorties du job d'installation
   qui lui disent quels sauts sont légitimes (`generates`, `whole`), de sorte qu'un job sauté qui
   aurait dû s'exécuter fait échouer la porte et qu'un brouillon ne peut pas être fusionné au vert.
   **Gain :** environ 6 500 secondes de *runner* par exécution d'un brouillon, jusqu'à 20 heures de
   *runner* par jour au trafic des trois jours, et la file qu'elles causaient. Une *pull request*
   prête et le tronc : 0. Les agents ouvrent leur *pull request* en brouillon jusqu'à ce que la
   branche soit définitive.
4. **Deux leviers qui ne changent rien à ce qu'une *pull request* prouve.** `proven-stacks` et
   `coverage-gate` construisent les *stacks* éprouvées une fois (un projet chacune, ses *specs*
   sous `test:coverage` ; les exécutions découpées et la *spec* retirée dans le même projet, sur la
   première *stack* d'une *pull request* ou du tronc et sur toutes la nuit). Le job des
   gestionnaires empaquette le kit une fois (`pipeline/monorepo/pack-kit.mjs`) au lieu d'une fois
   par fichier de *spec*, et installe une fois un projet de la première minute : l'installation
   figée est prouvée par `package-managers.spec.ts`. **Gain :** environ 215 secondes de *runner*
   par exécution de *pull request* et du tronc (la fusion environ 40, les empaquetages environ 75,
   environ sept installations figées environ 100), environ 600 la nuit. La fusion gagne moins que
   les 400 s du levier 4 ci-dessus parce que la décision 2 a déjà ramené la porte de couverture à
   une *stack*.

Là où la construction diffère du plan ci-dessus : l'ensemble couvrant ne s'applique qu'aux
balayages et aux exécutions de l'alias (le levier 3 le disait ; la décision disait « pas les 48 ») ;
un changement qui ne touche ni *template* ni générateur ne génère rien, même s'il touche un
*package* que tout projet généré installe (le noyau, le *package* de test, le *plugin* ESLint : leurs
propres jobs unitaires, et le tronc, les tiennent) ; le tronc exécute la porte de couverture sur une
*stack*, comme une *pull request*.

Attendu, avec ces quatre et les lignes de `fix/families-quick` : une exécution de *pull request*
qui touche un *template*, d'environ 7 700 à environ 4 400 secondes de *runner* ; une qui n'en
touche aucun, à environ 1 900 ; une exécution du tronc d'environ 8 000 à environ 5 900. Le temps de
mur d'une *pull request* suit le job unitaire sur Node 24 et le job npm.

Ce que les premières exécutions doivent montrer : les sorties `stacks`, `deep`, `generates` et
`whole` du job d'installation sur une *pull request* qui ne touche qu'un document (les cinq sauts
passent la porte), sur une qui touche un *template* (`cover`, les balayages à 16 *stacks*), sur un
brouillon et sur la même *pull request* marquée prête (une nouvelle exécution, la porte attendant
chaque job), sur une *pull request* de *release* (`all`, pnpm, Node 22, les paires), et sur la
première exécution du tronc (les 48 *stacks*, npm seulement).

## Reste à vérifier

- La durée de la lecture de mutation une fois la ligne de cette branche arrivée sur le tronc :
  attendue autour de 140 s contre 1 133 s, lue sur les dix premières *pull requests* qui suivent.
- Le temps de téléchargement et le taux de succès d'un cache de npm sur un *runner*, avant le
  premier point de [Pas maintenant](#pas-maintenant).
- La file sur une semaine une fois les lignes 1 à 7 en place, contre les 33 % du temps passés à la
  limite ou près d'elle sur ces trois jours.
- Le rappel de l'ensemble couvrant : chaque échec que trouve l'exécution du tronc et que la *pull
  request* n'a pas trouvé, relevé avec la paire de valeurs qui l'a causé.

## Sources

L'API de GitHub Actions (`gh api repos/<owner>/<repo>/actions/runs/<id>/jobs`, les journaux d'un
job à `actions/jobs/<id>/logs`) et `gh pr list --state merged --json files`, lus le 2026-10-26 ;
les chiffres de la station de travail et les médianes par job et par fichier sont dans
[generated-project-families.csv](generated-project-families.csv). Stryker : le mode incrémental
(`incremental`, `incrementalFile`) et le *reporter* json de `@stryker-mutator/core` 10, lus dans
`dist/src/reporters/mutation-test-report-helper.js` et `json-reporter.js`, qui écrivent tous deux
le rapport remis à `onMutationTestReportReady`.

## Voir aussi

- [Vélocité du build, des contrôles et des tests](build-and-test-velocity.fr.md)
- [Lanceurs de tests : Vitest et Jest](../tools/test-runners.fr.md)
- [Isoler les agents de code](../guides/agent-sandbox.fr.md)
- [Travailler en parallèle sans collisions](../guides/parallel-work.fr.md)
- Le *pipeline* de ce dépôt : [pipeline/README.md](../../pipeline/README.md)
