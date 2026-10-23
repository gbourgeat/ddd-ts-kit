[English](build-and-test-velocity.md) · **Français**
<!-- translation-of: build-and-test-velocity.md sha256:5859acc4b26d01a5 -->

# Proposition : vélocité du build, des contrôles et des tests

**Résumé.** Les machines des personnes et des agents qui travaillent sur ce dépôt, et les
*runners* gratuits de son *pipeline*, sont devenus le goulot d'étranglement : une exécution
complète des tests unitaires prend 9 Go de mémoire sur un portable, une *pull request* attend
jusqu'à sept minutes dans la file de GitHub Actions avant que ses jobs les plus longs ne
démarrent, et chaque contrôle s'exécute sur tout, que le changement l'atteigne ou non. Cette
page mesure où vont le temps et la mémoire, teste les leviers qu'offre l'outillage (*pools*,
isolation et sélection de Vitest ; caches et *threads* d'ESLint ; Oxlint avec son moteur typé ;
le parallélisme du compilateur natif ; npm contre pnpm), lit ce que d'autres équipes ont publié
sur les orchestrateurs (Nx, Turborepo, moon), les gestionnaires de *packages*, la sélection de
tests et les limites de GitHub Actions, et se termine par un plan dans l'ordre du gain par coût.
En bref : le compilateur est réglé (1,8 s pour les 26 *packages*), le temps de mur du *pipeline*
est fait de trois familles de bout en bout et d'une file d'attente, la mémoire d'un portable est
faite de 743 *workers* isolés et d'un fichier de *spec* qui compile des *fixtures* onze fois de
suite, et aucun orchestrateur ne changerait l'un ou l'autre ; ce qui aide, c'est la sélection,
le découpage, le cache du lint et moins de jobs par exécution.

## État (2026-10-23)

**Construit, lignes 1 à 7, en une journée ; deux essais courent pendant un mois.** Chaque ligne a
été une *pull request* à part, mesurée avant et après sur les indicateurs ci-dessous ; les
chiffres de la journée sont dans [Ce que la journée a mesuré](#ce-que-la-journée-a-mesuré). La
page française et celle-ci gardent l'étude telle qu'elle a été écrite, puis ce qu'elle est devenue.

| Partie | Verdict |
|---|---|
| 1. Moins de jobs par exécution du *pipeline*, les familles lourdes réduites sur une *pull request* | **construit** (#248) : cinq portes repliées en un job, la suite de l'alias sur une ligne de Node et les projets générés sur npm sur une *pull request* ; 24 jobs à 20 sur le tronc, 23 à 17 sur une *pull request* ; les *shards* de bout en bout et les exécutions de l'alias tenus aux *stacks* qu'un changement atteint sont venus avec la *pull request* `ci/e2e-stacks-reached` : un indicateur d'une *stack* qui nomme un *package* changé (un ORM, un *broker*, un cache, une file, un rapporteur, un *logger*, un stockage) la garde, un changement d'un *package* avec lequel chaque projet est construit les garde toutes, la première *stack* reste pour que chaque fichier exécute quelque chose |
| 2. La matrice de compilation de cinq fichiers de *spec* en parallèle | **construit** (#250) : les modes d'un fichier compilent quelques-uns à la fois, les six fichiers les plus longs démarrent en premier ; le fichier le plus long de 84 s à 27 s dans une exécution complète, le job unitaire du *pipeline* de 571 s à environ 490 s |
| 3. La moitié des cœurs hors *pipeline*, les *specs* des *packages* qu'une branche atteint avant un *push* | **construit** (#252) : l'étape unitaire du *hook* de 152 à 201 s et 9,3 à 11,5 Go, à 101 à 110 s et 6,8 à 7,3 Go sur une branche qui atteint tout, quelques secondes sur une feuille |
| 4. ESLint avec son cache par contenu, la vérification des types des *specs* en parallèle | **construit** (#253) : `npm run lint` de 36,5 s à 1,3 s quand rien n'a changé, le cache abandonné quand les règles du kit telles que construites, la config ou le *lockfile* ont changé (`pipeline/monorepo/lint.mjs`) ; le tronc écrit le cache du *pipeline*, une *pull request* le restaure ; `typecheck:tests` de 5,1 s à 3,3 s |
| 5. Le cache d'installation | **construit autrement** (#254) : la clé suivait déjà le *lockfile* et les manifestes qu'elle contient gardent le *lockfile*, donc la clé reste ; la moitié des 10 Go étaient les caches de *pull requests* fusionnées, supprimés désormais à la fermeture d'une *pull request* ; 10 052 Mo à 5 637 Mo le jour où le *workflow* est arrivé |
| 6. Les familles lourdes exécutent deux fichiers à la fois, leur géant d'un seul fichier coupé (réécrite : le job unitaire a cessé d'être le plus long après la ligne 2) | **construit** (#255) : les projets générés et les exécutions de l'alias deux fichiers à la fois avec deux *workers* chacun, `alias-runtime.spec.ts` en deux moitiés, les *shards* de bout en bout équilibrés sur des secondes mesurées (505 à 521 s chacun, de 352 à 715 s) ; sur quatre cœurs la famille *managers* de 521 s à 308 s ; deux fichiers à la fois a été essayé sur les *shards* aussi et a fait expirer les *specs* d'un projet généré : ils restent à un à la fois |
| 7. Oxlint avec tsgolint et les règles du kit comme *plugin* JS ; *runners* arm64 | **à l'essai** (#256) : la seule règle qui cassait sous l'API de *plugins* corrigée (#257 répare la règle *stepdown* sur les scripts, qu'Oxlint a révélée), `npm run lint:oxlint` 6 s et 1,0 Go contre 35 s et 3,0 Go, un job du tronc et de la nuit à côté d'ESLint ; les *specs* unitaires et le troisième *shard* de bout en bout sur `ubuntu-26.04-arm` la nuit ; verdicts après un mois |
| pnpm pour ce dépôt | **pas maintenant** : 1 s au lieu de 8 s par installation, derrière la même restauration de cache ; le filtre qu'il offre existe déjà |
| Nx, Turborepo, moon, Lage, Rush | **non** : plus rien à mettre en cache, la sélection des *packages* atteints existe, un cache distant coûte ou expose |
| Biome comme *linter*, bun test ou node:test comme *runner* | **non** : les types, les modules natifs et la couverture |

### Ce que la journée a mesuré

Les chiffres du *pipeline* sont des médianes sur les exécutions du 2026-10-23, douze exécutions
du tronc et 38 de *pull requests* avant la fusion de la première ligne (18:10 UTC), huit et huit
après ; une seule journée sur des *runners* partagés, avec d'autres exécutions dans la file, donc
les écarts de moins d'un cinquième sont du bruit, et les essais de la septième ligne continuent
de mesurer. Les chiffres de la station de travail sont ceux des sections ci-dessus, pris sur une
machine calme. Deux lignes dépendent de ce qui tournait d'autre : la file d'un job et le temps de
mur d'une exécution suivent le trafic du dépôt autant que le plan. Ce trafic n'était pas plus
léger après : les exécutions lancées par heure étaient de 6 à 8 l'après-midi d'où viennent les
chiffres d'avant et de 10 à 12 le soir de l'après, chacune avec moins de jobs (environ 170 et
environ 215 jobs par heure), donc la baisse n'est pas celle du trafic ; mais une journée ne peut
pas dire quelle part en revient au plan. Ces deux lignes sont à confirmer sur plusieurs jours de
trafic égal ; les autres ne dépendent pas de la file.

| Indicateur | avant | après les lignes 1 à 6 |
|---|---|---|
| jobs par exécution, tronc et *pull request* | 24 et 23 | 20 et 17 |
| temps de mur d'une exécution de *pull request*, médiane et p95 (à confirmer sur plusieurs jours) | 1 073 s et 1 687 s | 800 s et 1 294 s |
| file d'un job d'une *pull request*, p95 et maximum (à confirmer sur plusieurs jours) | 461 s et 879 s | 162 s et 438 s |
| temps de mur d'une exécution du tronc, médiane (à confirmer sur plusieurs jours) | 1 248 s | 1 069 s |
| le job unitaire du tronc (Node 24, couverture) | 571 s | environ 490 s |
| les projets générés sur npm (tronc) | 790 s | 648 s (une exécution) |
| la suite de l'alias sur Node 24 (tronc) | 624 s | 276 à 441 s (deux exécutions) |
| la suite unitaire sur la station, 20 cœurs et 4 *workers* | 88 à 104 s, 203 s | 81 s, 139 s |
| le fichier de *spec* le plus long d'une exécution complète | 84 s | 27 s |
| l'étape unitaire avant un *push*, mur et pic de mémoire | 152 à 201 s, 9,3 à 11,5 Go | 101 à 110 s, 6,8 à 7,3 Go |
| `npm run lint` quand rien n'a changé | 36,5 s | 1,3 s |
| la famille *managers* sur quatre cœurs | 521 s | 308 s |
| le cache du *pipeline* | 10 052 Mo, plein | 5 637 Mo, les caches d'une *pull request* fermée supprimés |

Ce qui n'a pas bougé : les quatre *shards* de bout en bout (450 à 720 s sur la seule exécution du
tronc après la sixième ligne, contre 454 à 659 s avant : leur équilibre et les deux fichiers à la
fois des autres familles n'ont pas changé leur somme), et le job de lint du tronc, qui écrit le
cache plutôt qu'il ne le lit (les *pull requests* le lisent).

## La question

Les outils de qualité, de build et de contrôle du dépôt peuvent-ils consommer moins de CPU et de
mémoire, ne s'exécuter que sur les parties qu'un changement atteint, en local comme dans le
*pipeline*, et pnpm *workspaces*, Nx ou un autre système apporteraient-ils de la vélocité à
qualité égale ? La réponse doit tenir pour un gros projet avec beaucoup de travail en
parallèle : plusieurs personnes et plusieurs agents à la fois, sur une même machine et sur les
*runners* gratuits d'un dépôt public.

## Méthode et indicateurs

Chaque chiffre de cette page est l'un de ces indicateurs, mesuré de la même façon, pour qu'un
changement ultérieur soit comparé sur la même échelle.

| Indicateur | Ce qu'il répond | Comment il est mesuré ici |
|---|---|---|
| temps de mur | combien de temps une personne ou un agent attend | `/usr/bin/time`, ou l'horloge autour de la commande ; p50 et p95 sur les exécutions du *pipeline* |
| temps CPU (utilisateur + système) | ce que coûte une exécution sur des *runners* comptés en minutes, et si le parallélisme sursouscrit | `/usr/bin/time` |
| pic de mémoire de l'arbre de processus | si un portable *swappe* ou redémarre | la mémoire résidente de chaque processus sous la commande, sommée chaque seconde, à son pic |
| temps de file | l'attente avant qu'un job démarre, le prix de la limite de jobs concurrents | `started_at` moins `created_at` de chaque job, par l'API de GitHub |
| taux de sélection et rappel des tests | combien une exécution réduite saute, et si un test qui échoue est encore sélectionné | les fichiers qu'une sélection exécute sur le tout ; l'exécution complète sur le tronc et la nuit rattrape ce qu'une sélection manque |
| parité des constats | si un outil plus rapide trouve les mêmes choses | le diff des constats des deux outils sur le même arbre |
| taux de succès du cache | si un cache paie sa restauration | les succès sur les exécutions, par cache |

Les mesures locales ont été prises le 2026-10-23 sur une station de travail (20 cœurs, 32 Go,
Linux, Node 24.22, npm 11.19), sous `nice`, une commande à la fois, la charge de la machine
enregistrée chaque seconde. La station est partagée avec un éditeur et avec d'autres sessions
d'agents de code : trois exécutions qui ont chevauché une charge étrangère ont été écartées et
reprises. Une seule exécution par réglage, pas dix : les chiffres sont indicatifs à 10 % près,
ce qui suffit aux décisions ci-dessous, où les écarts vont de 1,5x à 50x. Les chiffres du
*pipeline* sont lus par l'API de GitHub Actions sur deux exécutions du tronc (2026-10-23, #241
et #242) et une exécution de *pull request* (#243). Les sources des autres équipes citées en
section 6 sont listées à la fin ; un chiffre publié par l'entreprise qui vend l'outil est marqué
« vendeur ».

Le dépôt ce jour-là : 26 *packages*, 160 840 lignes de TypeScript sous `src`, 148 914 sous
`test`, 743 fichiers de *spec* et 11 051 tests, un `node_modules` de 1,5 Go avec 833 entrées de
premier niveau, 280 *commits* sur le dernier mois.

## Ce que le dépôt coûte aujourd'hui

### Sur une station de travail

| Étape | Mur | CPU | Pic de mémoire | Note |
|---|---|---|---|---|
| `tsc -b` des 26 *packages*, compilateur natif, depuis zéro | 1,8 s | 11,9 s | 0,86 Go | 747 % d'un cœur |
| la même chose avec TypeScript 6 | 13,0 s | 20,5 s | 1,67 Go | gardé pour les *specs* qui compilent des *fixtures* des deux façons |
| `tsc -b` sans rien à faire | 1,7 s | 8,7 s | 0,66 Go | les informations de build sont lues, les sources vérifiées de nouveau |
| `add-extensions` sur `dist` | 0,3 s | | | |
| Biome, vérification du format | 0,8 s | 4,8 s | 0,22 Go | |
| knip | 2,8 s | 3,8 s | 0,52 Go | |
| dependency-cruiser | 3,2 s | 4,7 s | 0,65 Go | |
| `npm ci`, cache de npm chaud | 14,0 s | | 1,9 Go | |
| `vitest run`, tout | 88 à 104 s | | **9,3 à 11,3 Go** | deux exécutions ; 743 *workers*, un par fichier (section 4) |
| `vitest run --coverage`, tout | 152 s | **1 585 s** | | 26 minutes de CPU : ce qu'un *runner* à 4 vCPU paie |
| les neuf fichiers `node --test` du job architecture | 72 s | | 0,3 Go | la garde, les *skills*, les scripts du *pipeline* : l'essentiel de ce job |
| ESLint, tout | voir la section 5 | | | |
| vérification des types des *specs* (25 projets à la suite) | voir la section 5 | | | |

Le compilateur n'est plus un coût : le build complet des 26 *packages* prend moins de temps que
la phase d'import d'un seul fichier de *spec*. Tout ce qui suit concerne le lint, les tests et
le *pipeline*.

### Dans le *pipeline*

Une exécution du tronc a 24 jobs ; son temps de mur est de 20 à 23 minutes. Les jobs qui
finissent en dernier, et la file qu'ils ont attendue avant de démarrer (exécution #242 du tronc,
puis la *pull request* #243) :

| Job | Exécution (tronc) | File (tronc) | Exécution (PR) | File (PR) |
|---|---|---|---|---|
| Projet généré sur npm | 790 s | 28 s | 834 s | **394 s** |
| Tests de bout en bout (4 *shards*) | 571 à 763 s | 90 à 112 s | 546 à 650 s | 241 à **454 s** |
| Projet généré sur pnpm | 653 s | 45 s | 644 s | 444 s |
| Alias d'import à l'exécution (Node 22, Node 24) | 703 à 716 s | 2 à 74 s | 577 à 623 s | 225 à 296 s |
| Tests unitaires (Node 24, planchers de couverture) | 602 s | 3 s | 571 s | 23 s |
| Tests unitaires (Node 22) | 504 s | 96 s | 424 s | 131 s |
| Application d'exemple | 236 s | 47 s | 380 s | 370 s |
| les 12 autres jobs | 3 à 159 s | 2 à 91 s | 2 à 170 s | 2 à 395 s |

Trois choses décident du temps de mur, et aucune n'est un outil.

1. **Les trois familles qui intègrent tous les *packages*** : les projets générés sur les deux
   gestionnaires, les quatre *shards* de la suite de bout en bout et les exécutions de l'alias
   sur les deux lignes de Node génèrent environ 35 projets d'exemple et exécutent tout leur
   *pipeline* (installation, compilateur, lint, tests, *check*). Elles prennent 10 à 14 minutes
   chacune, ne sont jamais réduites sur une *pull request* (seulement sautées quand seuls des
   documents ont changé), et fixent le plancher de chaque exécution.
2. **La limite de 20 jobs concurrents** du plan Free, partagée par toutes les exécutions du
   dépôt. Le 2026-10-23 le dépôt a exécuté 103 *pipelines* (72 exécutions de *pull request*, 31
   *pushes*), environ 2 500 jobs pour une limite de 20 à la fois : la file d'un job a atteint
   454 s sur une *pull request*, 112 s sur le tronc. Des sessions parallèles qui ouvrent chacune
   une *pull request* font la queue les unes derrière les autres.
3. **Le cache d'installation est plein** : 142 entrées, 10,6 Go pour une limite de 10 Go, dont
   24 copies de `node_modules` à 330 Mo chacune. La clé de ce cache hache chaque
   `packages/*/package.json`, donc chaque version publiée écrit deux nouvelles copies (une par
   ligne de Node), et une *pull request* écrit la sienne à côté de celles du tronc. L'éviction
   est horaire et par usage le moins récent : une exécution qui manque le cache paie une
   installation au lieu d'une restauration de 15 à 20 s.

Les jobs déjà réduits fonctionnent : sur la *pull request* ci-dessus, `affected-packages.mjs` a
tenu le job unitaire aux *packages* que le changement atteignait, et le job d'installation a
répondu en 34 s depuis les caches.

### Où la suite unitaire passe son temps

La somme des durées des 743 fichiers est de 564 s pour 104 s de temps de mur : la suite exécute
5 à 6 fichiers à la fois en moyenne sur 20 cœurs, pas 20, parce que les fichiers les plus longs
dominent la fin de l'exécution. Par *package*, la somme des durées des fichiers :

| *Package* | Fichiers | Tests | Somme des durées |
|---|---|---|---|
| cli | 267 | 3 749 | 272 s |
| kernel | 59 | 816 | 90 s |
| http | 47 | 611 | 29 s |
| aspects | 16 | 218 | 28 s |
| di | 33 | 384 | 24 s |
| redis | 25 | 164 | 18 s |
| eslint-plugin | 51 | 1 752 | 17 s |
| les 19 autres | 245 | 3 357 | 87 s |

Les cinq fichiers les plus longs ne le sont pas par leur nombre de tests : leur `beforeAll`
compile un projet de *fixture* avec les deux compilateurs sous chaque réglage de décorateurs,
un mode après l'autre dans le même fichier (`packages/kernel/test/support/decorator-modes.ts` :
deux compilateurs, cinq réglages, onze modes avec celui que le *runner* transforme lui-même).

| Fichier | Mur | Ce qu'il fait |
|---|---|---|
| `kernel/test/declarations.spec.ts` | **84 s** | onze compilations de la clinique, à la suite |
| `cli/test/e2e/zero-violation.spec.ts` | 44 s | chaque *stack* générée et vérifiée |
| `aspects/test/decorators.spec.ts` | 27 s | onze compilations, à la suite |
| `cli/test/e2e/formatted.spec.ts` | 27 s | |
| `http/test/controllers.spec.ts` | 25 s | cinq compilations, à la suite |
| `di/test/discovered-context.spec.ts` | 22 s | onze compilations, à la suite |

Un fichier est l'unité de parallélisme du *runner* : aucun nombre de cœurs, de *workers* ou de
*shards* ne rend une exécution plus courte que son fichier le plus long. Le fichier de 84 s est
le plancher de chaque exécution unitaire sur chaque machine, et la raison pour laquelle la suite
n'utilise que 5 fichiers à la fois en fin d'exécution.

Les 84 s ne sont pas le coût de la matrice elle-même : le *package* kernel seul, ses onze
compilations comprises, s'exécute en 13 s (`vitest run packages/kernel`). Dans l'exécution
complète, chaque compilation, qui prend tous les cœurs que le compilateur natif trouve, est en
concurrence avec 20 *workers* et avec les compilateurs que les autres fichiers lancent, et dure
six fois plus longtemps. La suite sursouscrit la machine : 20 *workers* qui démarrent chacun des
processus de 8 *threads*. C'est pourquoi la moitié des *workers* ne coûte que 14 % de temps de
mur (section 4) et pourquoi la matrice de compilation, exécutée en parallèle dans son fichier
ou découpée par fichier, est le levier sur la longueur de l'exécution.

## Expériences sur le *runner* de tests

Chaque exécution ci-dessous est `vitest run` sur toute la suite, sur la station de travail de la
méthode, avec le *pool* par défaut (`forks`) et l'isolation sauf mention contraire.

| Réglage | Mur | Pic de mémoire | Fichiers en échec | Lecture |
|---|---|---|---|---|
| défaut : `forks`, isolé, un *worker* par cœur | 104 s, puis 88 s | 9,3 Go, puis 11,3 Go | 0 | la référence, exécutée deux fois (la seconde sur une machine plus calme) |
| `--maxWorkers=50%` | 101 s | **6,8 Go** | 0 | la moitié des cœurs : 40 % de mémoire en moins pour 14 % de temps en plus (1) |
| `--maxWorkers=4` (un *runner* gratuit) | 203 s | 4,4 Go | 0 | ce qu'un *runner* à 4 vCPU fait, avec ici les compilateurs enfants sur les autres cœurs |
| `--maxWorkers=4 --coverage` | 216 s | 4,2 Go | 0 | la couverture coûte 6 % à quatre *workers*, 46 % à vingt |
| `--pool=threads` | 480 s | 10,8 Go | 22 | les *specs* sur PGlite, knex et prisma expirent dans leurs *hooks* : les *threads* sont exclus pour cette suite |
| `--pool=threads --coverage` | 471 s | 11,2 Go | 17 | idem |
| `--no-isolate` | 68 s | **17,7 Go** | 2 | les *workers* gardent chaque module chargé : 23 % de temps en moins, 60 % de mémoire en plus, et deux *specs* de traçage lisent les *spans* d'une autre (1) |
| `--no-isolate --sequence.shuffle`, deux fois | 84 s, 78 s | 20,3 Go, 19,6 Go | **44, puis 30** | l'ordre des fichiers décide des *specs* qui passent : la suite n'est pas prête à partager ses *workers* |
| `vitest related packages/kernel/src/domain/aggregate-root.ts` | 13 s | 2,1 Go | 0 | 58 fichiers sur 745 : les importateurs de la racine d'agrégat |
| `vitest related packages/pino/src/index.ts` | 2 s | 0,5 Go | 0 | 3 fichiers sur 745 |
| `vitest run --changed 660215aa` | 85 s | 10,4 Go | 0 | tout : l'intervalle touchait le *lockfile*, ce qui relance tout par conception |
| `vitest run packages/kernel` | 13 s | 2,2 Go | 0 | un *package* seul, sa matrice de compilation comprise |
| `vitest run packages/pino` | 2 s | 0,6 Go | 0 | |
| `vitest doctor packages/kernel` | 142 s | 3,0 Go | | la comparaison du *runner* lui-même sur un *package* : *threads* 3 %, `isolate: false` 8 %, 9 *workers* 7 % plus rapides ; il recommande 9 *workers* |

(1) La première mesure de ces deux réglages a été prise pendant qu'une autre session chargeait
la machine (charge moyenne de 32 à 49 sur 20 cœurs) et a mis 9 et 1 fichiers en échec sur des
expirations ; le tableau montre la seconde mesure, prise sur une machine calme.

Ce que dit le tableau :

- **L'isolation n'est pas le levier ici.** Les deux leviers documentés du *runner*,
  `isolate: false` et le *pool* `threads`, ne conviennent pas à cette suite : les *specs*
  démarrent des bases PGlite, des compilateurs enfants et des serveurs en processus, que les
  *threads* ne peuvent pas héberger, et qui gardent leur mémoire une fois un *worker* réutilisé
  (17 à 20 Go sans isolation). Sans isolation, 30 à 44 fichiers échouent selon l'ordre de
  l'exécution : la suite compte sur des modules frais, comme la plupart des suites de ce genre,
  et la rendre indépendante de l'ordre coûterait plus que les 23 % qu'elle donnerait. Les 9 à
  11 Go sont 20 *workers* d'environ 450 Mo chacun, plus les processus enfants ; le levier sur un
  portable est le nombre de *workers*, que les projets générés plafonnent déjà à la moitié des
  cœurs hors *pipeline*, et que ce dépôt ne plafonne pas.
- **La sélection sous le *package* fonctionne et coûte peu.** `vitest related` sur un fichier
  source exécute les fichiers qui l'importent, par le graphe statique des imports, en 2 à 13 s
  au lieu de 104 s. `--changed` exécute tout dès que l'intervalle touche le *lockfile*, la
  config ou un fichier de *setup*, ce qui est le comportement documenté et le bon.
- **La couverture coûte peu à quatre *workers* et cher à vingt** : son coût est dans le
  processus principal qui recompose les rapports, goulot quand 20 *workers* l'alimentent.

## Expériences sur le lint, la vérification des types, le build et l'installation

Même station de travail, même méthode ; la colonne des constats dit si une exécution a rapporté
les mêmes choses que l'exécution de référence d'ESLint (un avertissement sur cet arbre).

| Étape | Réglage | Mur | Pic de mémoire | Constats et lecture |
|---|---|---|---|---|
| ESLint | comme le *pipeline* l'exécute (`eslint .`) | 34,9 s | 3,0 Go | 1 avertissement ; 58 à 87 s sur un *runner* à 4 vCPU |
| ESLint | les sources seules, `TIMING=1` | 28,7 s | 2,8 Go | aucune règle ne domine : `no-unsafe-argument` 2,8 %, `no-unnecessary-condition` 2,2, `unbound-method` 1,8 ; le coût est le programme de types lui-même |
| ESLint | `--cache --cache-strategy content`, première exécution | 34,9 s | 3,0 Go | même constat ; le cache ne coûte rien à écrire |
| ESLint | la même, deuxième exécution, rien de changé | **2,1 s** | 0,4 Go | même constat : un lint 17x plus court quand l'arbre n'a pas changé |
| ESLint | `--concurrency=auto` | 21,7 s | **15,8 Go** | même constat ; chaque *thread* construit son propre programme de types : cinq fois la mémoire pour un tiers de temps en moins |
| Oxlint 1.89 | les 146 règles gardées par le migrateur, sans types (deux fois) | **2,0 s** | 0,3 Go | 16 constats qu'ESLint ne rapporte pas : 14 `no-redeclare` sur les paires interface et classe des déclarations (TypeScript les fusionne ; typescript-eslint laisse cette règle au compilateur), 2 `no-unsafe-optional-chaining` |
| Oxlint | `--type-aware` (tsgolint 7.0) (deux fois) | **4,1 s** | 1,1 à 1,3 Go | les 16 ci-dessus plus un `unbound-method` qu'ESLint ne rapporte pas : à examiner |
| Oxlint | `--type-aware --type-check` | 6,2 s | 1,7 Go | 5 erreurs de types que `tsc` ne rapporte pas, toutes sous `test/` : les fichiers ont été vérifiés contre le `tsconfig.json` de leur *package* (les sources seules), pas contre leur `tsconfig.test.json` |
| Oxlint | les 70 règles du kit comme *plugin* JS, sans types (deux fois) | 4,1 s | 0,4 Go | **le *plugin* échoue sur 2 494 fichiers** (« Error running JS plugin: cannot convert undefined or null to object ») et rapporte 43 constats `clean-stepdown` qu'ESLint ne rapporte pas : l'API de l'alpha ne porte pas ce que les règles lisent |
| Oxlint | la même avec `--type-aware` (deux fois) | 6,1 s | 1,3 à 1,5 Go | idem |

Oxlint lit tout l'arbre en 2 s et ses règles typées en 4 s, contre 35 s pour ESLint : la
vitesse rapportée par les autres équipes tient ici. Les constats, non : avec les règles de
typescript-eslint et d'ESLint seules, 16 à 17 constats apparaissent qu'ESLint ne rapporte pas,
une règle à désactiver (`no-redeclare`) et trois à examiner ; avec les règles du kit chargées
par l'API de *plugins* JS, qui est en alpha, le *plugin* casse sur 2 494 des fichiers et la
règle *stepdown* rapporte 43 constats qu'ESLint ne rapporte pas. La parité des constats n'y est
pas, et tant que le *plugin* ne tourne pas entier sous cette API, Oxlint ne peut pas être la
porte d'un projet qui utilise le kit. Il peut tourner à côté d'ESLint, sans bloquer, pour
mesurer l'écart à mesure que l'API mûrit.
| vérification des types des *specs* | 25 `tsc -p` à la suite | 5,1 s | 0,4 Go | le job typecheck du *pipeline* (39 à 44 s) est sa mise en place et le build, pas la vérification |
| vérification des types des *specs* | les 25 à la fois | 2,3 s | 2,4 Go | six fois la mémoire pour la moitié du temps : plafonner aux cœurs du *runner* |
| `check --self` | 665 *fixtures* de règles | 2,0 s | 0,1 Go | le job architecture (138 à 170 s) tient à ses autres étapes : le script de version, dependency-cruiser et neuf fichiers `node --test` |
| `tsc -b` depuis zéro | `--builders 1 --checkers 1` | 4,1 s | 0,7 Go | ce qu'un seul cœur prendrait : toujours sous la restauration d'un cache |
| `tsc -b` depuis zéro | `--builders 2 --checkers 2` | 3,1 s | 0,6 Go | un *runner* à 4 vCPU |
| `tsc -b` depuis zéro | parallélisme par défaut, 20 cœurs | 2,0 s | 0,6 Go | |
| installation | `npm ci`, sans `node_modules`, cache de npm chaud (trois exécutions) | 8,2 à 9,2 s | 1,8 Go | `npm ci` écrit toujours tout l'arbre, 1 345 *packages* |
| installation | `pnpm install`, pas encore de *lockfile*, *store* par défaut | 106 s | 0,8 Go | la résolution, puis la vérification de chaîne d'approvisionnement de pnpm 12 sur les 1 557 entrées du nouveau *lockfile* |
| installation | `pnpm install --frozen-lockfile`, *store* chaud, vérification pas encore en cache | 51 s | 1,0 Go | 50,3 s de « lockfile passes supply-chain policies », 0,5 s de liens |
| installation | la même, *store* vide | 211 s | 0,5 Go | le téléchargement des 1 361 *packages* |
| installation | la même, *store* chaud, vérification en cache | **0,6 à 2,0 s** | 0,06 Go | des liens durs depuis le *store* : 1 361 *packages* en moins d'une seconde |
| installation | la même avec `minimumReleaseAge: 0` | 0,6 s | 0,2 Go | la vérification sautée |
| installation | rien à faire (`node_modules` présent) | pnpm 0,05 s, npm 8,2 s | | npm réinstalle, pnpm répond |

## Ce que d'autres équipes ont trouvé

Trois notes de recherche, écrites le 2026-10-23 à partir de sources publiques seulement, sont
résumées ici ; les sources sont à la fin de la page. Ce qu'elles enseignent, appliqué à ce
dépôt :

### Compilateurs

TypeScript 7 (natif, juillet 2026) est 8 à 12x plus rapide que TypeScript 6 sur les builds
complets dans les tableaux de Microsoft, 3x dans les retours de première main de Prisma (74 s à
24 s sur des dizaines de *packages*) et d'une application de 728 fichiers (6,7 s à 2,1 s), 7x
pour VS Code (36 s à 5 s). La mémoire a baissé bien moins que le temps (6 à 26 %). À 1,8 s et
0,86 Go, ce dépôt est déjà aux chiffres des plus petits projets de ces tableaux ; 7.1 (bêta
d'octobre 2026) annonce encore 1,2 à 1,9x et 16 à 50 % de mémoire en moins. `--builders` et
`--checkers` fixent le parallélisme et multiplient la mémoire. `tsc -b` avec des références de
projets n'achète plus de vitesse à cette taille ; il reste pour les `.d.ts` de chaque *package*,
que les *linters* typés lisent. Le seul écart ouvert qui compte : typescript-eslint ne peut pas
utiliser le compilateur natif avant la sortie de son API en 7.1, et le pont expérimental est
1,5x plus lent que TypeScript 6, pas plus rapide.

### *Linters*

typescript-eslint dit lui-même qu'un lint typé s'exécute à peu près aussi lentement que la
vérification des types du même projet sous le compilateur qu'il utilise, soit TypeScript 6. Les
leviers rapportés sans changer d'outil : `--cache --cache-strategy content` avec le cache gardé
comme artefact du *pipeline* (54 s à 2,4 s à chaud sur 4 vCPU, les mêmes 344 constats, une
équipe), `TIMING=1` pour évaluer le prix des règles, chaque fichier couvert par le tsconfig de
son *package* (un fichier couvert par aucun coûte 5 à 15 s), et `--concurrency=off` sur des
*runners* à 4 vCPU, où les *threads* ont été plus lents dans les deux rapports mesurés (un seul
*thread* 54 s et 6,2 Go ; 8 *workers* 31 s et 32,6 Go). Un cache ou un lint des seuls fichiers
changés manque l'effet d'un changement sur les types des autres fichiers : un lint typé complet
par fusion reste.

Oxlint avec tsgolint (typé, stable depuis juillet 2026, 59 des 61 règles typées de
typescript-eslint) est la seule voie rapportée vers un lint typé de quelques secondes : 12 à 18x
dans les tableaux de ses auteurs, 20,5 s à 1,3 s avec tous les constats plus 13 de plus dans une
mesure indépendante sur 403 fichiers, 2 min 27 s à 1,3 s sur un monorepo Nx de 206k lignes, mais
seulement 2x pour ManoMano (500k lignes). Ses préalables sont remplis ici (TypeScript 7, pas de
`baseUrl`, `.d.ts` construits). Ses coûts : les règles maison passent par des *plugins* JS, en
alpha et au coût réel (un *plugin* a fait passer une exécution de 2,5 s à 38 s), deux règles
typées manquantes, quelques messages de règles perdus, une correction automatique qui a un jour
retiré des assertions dont le compilateur avait besoin. Les 70 règles du kit sont le risque à
mesurer, pas à supposer : d'où l'expérience de la section 5.

Biome 2.5 reste le formateur : son inférence de types a trouvé 1 promesse flottante sur 2 et 0
promesse mal utilisée sur 6 dans le seul test indépendant, et ses auteurs disent ne pas
implémenter de système de types.

### *Runners* de tests

Les leviers documentés de Vitest 5 sont l'isolation désactivée (une suite React de 10k tests,
12 min à 2 min, après la correction d'une centaine de tests dépendants de l'ordre), le *pool*
`threads`, le nombre de *workers* (au-delà des vCPU une suite limitée par le CPU ralentit :
823 s à 4 *workers*, 925 s à 5, sur une machine à 4 vCPU), le *sharding* entre machines avec les
seuils de couverture tenus sur le rapport fusionné (430 fichiers, 887 s à 4 min 25 s avec 6
*shards*, une équipe), `--changed` et `related` pour la sélection, et
`experimental.recordDependencies` (5.0.4) qui enregistre ce que chaque test a réellement chargé,
avec des trous documentés (*fixtures* lues avec `fs`, fabriques `vi.mock`, imports dynamiques
jamais appelés). Un fichier est une entrée atomique d'un *shard* : NVIDIA a découpé des fichiers
de *spec* de 63 à 84 s pour cette raison. node:test exécute un processus par fichier et était
« nettement plus lent » pour Astro ; bun test ne peut pas exécuter le fournisseur de couverture
v8 ; aucun des deux n'a de comparaison publiée à 500 fichiers.

### Orchestrateurs

Chaque grand gain publié de Nx ou de Turborepo (Hetzner 45 min à 6 min, un distributeur 60 min
à 8 min, Porsche Digital 12 min à 4,2 min) combine un cache distant de builds lents, une
distribution sur de nombreux agents et un redécoupage des frontières de projets ; le seul tableau
indépendant, celui de Sentry, a déplacé l'exécution médiane de 10 % (20 min à 18 min) parce que
les tests, pas les builds, dominaient. Les équipes qui ont quitté ou jamais adopté un
orchestrateur (Trilium Notes, eslint-react, XWiki) citent le démon, les remises à zéro du cache,
les dépréciations et la crainte d'un cloud payant. Les *packages* de cache auto-hébergé de Nx
ont été dépréciés le 2026-05-21 après la vulnérabilité CREEP (CVE-2025-36852 : une *pull
request* peut semer le cache que le tronc lit) ; les caches distants restants sont un cloud
payant ou limité par quota, un serveur à opérer, ou le cache de GitHub Actions, dont le
cloisonnement empêche déjà une *pull request* d'écrire ce que le tronc lit. L'incident de chaîne
d'approvisionnement d'août 2025 (« s1ngularity », versions malveillantes de nx) ajoute une
raison de garder peu d'outils de build. Nx 24 (octobre 2026) sélectionne les tâches atteintes
par leurs entrées déclarées, plus fin que la sélection par *package* de ce dépôt, au prix de
déclarer et de maintenir ces entrées.

### Gestionnaires de *packages*

Le propre *benchmark* de pnpm donne l'installation d'un *pipeline* avec *lockfile* à 3,4 s contre
13,9 s pour npm sur un petit graphe, 9,2 s contre 37,7 s sur un graphe de 1 Go ; il offre
`--filter "...[origin/main]"` (les *packages* changés et leurs dépendants) et des catalogues. Ses
coûts sont la rigueur de sa disposition par liens symboliques (doublons de dépendances *peer*,
motifs de *hoisting*, `preserveSymlinks` interdit). Aucun *benchmark* de première main n'existe
pour Yarn 4 ; le « 25x » de Bun n'a pas de conditions énoncées.

### GitHub Actions

Les dépôts publics ont des *runners* standard gratuits de 4 vCPU et 16 Go, en x64 (deux cœurs
avec *hyper-threading*) et en arm64 (`ubuntu-26.04-arm`, quatre cœurs physiques, en
disponibilité générale depuis le 2026-09-17) ; les deux *benchmarks* trouvés se contredisent
(x64 gagne en mono-cœur, arm64 sur tous les cœurs), donc une charge Node doit être mesurée. Le
plan Free exécute 20 jobs à la fois et met le reste en file ; les *runners* plus grands sont
payants et demandent un plan Team. Le cache tient 10 Go par dépôt, évincé chaque heure par
usage le moins récent ; sa clé devrait hacher le *lockfile*, l'OS, l'architecture et la ligne de
Node, pas le *commit*. Un filtre de chemins ne peut pas sauter un contrôle requis, d'où le
motif d'un job porte qui lit tous les autres (que ce dépôt a). Une file de fusion est disponible
pour les dépôts publics d'une organisation.

## Jugement : les options comparées

| Option | Gain attendu ici | Coût ou risque | Verdict |
|---|---|---|---|
| moins de jobs par exécution (fusionner les huit jobs de moins de trois minutes en deux) | la file : 24 jobs à environ 17 par exécution, pour le même travail | aucun ; un échec nomme son étape | **faire** |
| les familles lourdes réduites sur une *pull request* (une ligne de Node, un gestionnaire, les *stacks* qu'un changement atteint), tout sur le tronc et la nuit | 10 à 14 min de *runner* par famille sautée, la file libérée pour tous | une régression attrapée la nuit ou sur le tronc au lieu de la *pull request* : le motif que Sentry et netlify/cli utilisent | **faire** |
| la matrice de compilation de cinq fichiers de *spec* en parallèle (un `Promise.all` des modes) ou un fichier par mode | le fichier le plus long de 84 s à environ 15 s ; l'exécution unitaire ne traîne plus sur un fichier | quelques fichiers de *spec* de plus ; la matrice reste entière | **faire** |
| la moitié des cœurs hors *pipeline* dans `vitest.config.ts`, comme les projets générés | 9,3 Go à environ 6,8 Go sur un portable | l'exécution complète prend moitié plus de temps ; `VITEST_MAX_WORKERS` l'emporte | **faire** |
| `vitest related` et la sélection des *packages* atteints avant un *push*, au lieu de l'exécution unitaire complète avec couverture | 152 s à 2 à 13 s pour un changement d'un *package* | ce que la sélection manque s'exécute sur le tronc ; un changement du *lockfile* ou d'une config relance tout | **faire** |
| ESLint `--cache --cache-strategy content`, le cache en artefact du *pipeline* | mesuré en section 5 | un changement de types dans un autre fichier n'est vu que par l'exécution complète du tronc | **faire** |
| la vérification des types des *specs* en parallèle | mesuré en section 5 | la mémoire, 25 compilateurs à la fois : plafonner aux cœurs du *runner* | **faire** |
| la clé du cache d'installation sur le *lockfile*, l'OS, l'architecture et la ligne de Node | moins de copies de 330 Mo, moins de manques | aucun | **faire** |
| les familles lourdes exécutent deux fichiers à la fois, leurs géants d'un seul fichier coupés (écrit d'abord comme deux *shards* du job unitaire) | les jobs les plus longs du tronc raccourcis sans job ajouté | deux projets générés partagent un *runner* : les installations recouvrent les *specs*, la mémoire double, les ports ne doivent pas se rencontrer | **faire, après la deuxième ligne** |
| Oxlint avec tsgolint, les règles du kit comme *plugin* JS, à côté d'ESLint et non bloquant | un lint typé de 4 s au lieu de 35 s (section 5) | le *plugin* du kit casse sur 2 494 fichiers sous l'API de *plugins* en alpha et une règle native contredit TypeScript ; deux règles typées manquantes ; constats à comparer jusqu'à ce que l'API porte ce que les règles lisent | **essayer, pas comme porte** |
| des *runners* arm64 pour les jobs unitaires et de bout en bout | quatre cœurs physiques au lieu de deux | inconnu tant que non mesuré : dix exécutions sur chacun, p50 comparés | **essayer** |
| pnpm pour ce dépôt | une installation de 1 s au lieu de 8 s quand son *store* est chaud (section 5), et rien à faire quand rien n'a changé | une migration du *lockfile*, de la disposition et de chaque *spec* qui lit `node_modules` ; dans le *pipeline* le *store* serait restauré depuis le cache comme `node_modules` l'est aujourd'hui, pour un gain de quelques secondes par job ; sa vérification de chaîne d'approvisionnement coûte 50 s la première fois qu'un *lockfile* est vu | **pas maintenant** |
| Nx, Turborepo ou moon | une sélection plus fine, un cache des sorties de tâches | rien de lent à mettre en cache (le build prend 1,8 s) ; le script de sélection existe ; un cache distant est payant, limité par quota, ou un serveur ; deux incidents en 2025 | **non** |
| Biome comme *linter* | un lint de 100 ms | les règles typées de `strictTypeChecked` ne sont pas couvertes | **non** |
| bun test ou node:test | | les modules natifs, PGlite, le fournisseur de couverture v8 ; aucun gain publié à cette taille | **non** |

## Recommandation : le plan, dans l'ordre

Chaque ligne est une *pull request*, avec l'indicateur qu'elle déplace écrit dans sa
description, mesuré avant et après sur les mêmes exécutions.

1. **Le *pipeline* : moins de jobs, et les familles lourdes réduites sur une *pull request*.**
   Fusionner les jobs de moins de trois minutes (docs, code mort, typecheck, lint, packages,
   sécurité, architecture, site) en deux jobs. Sur une *pull request*, exécuter la suite de
   l'alias sur une ligne de Node, les projets générés sur npm seulement, et les *shards* de bout
   en bout sur les *stacks* que le changement atteint (un *template* de
   `packages/<name>/templates/` atteint les *stacks* qui utilisent ce *package* : la sélection
   est celle d'`affected-packages.mjs`, étendue à la table `STACKS` de la suite). Le tronc et la
   nuit gardent toute la matrice, comme aujourd'hui. Indicateurs : temps de file p50 et p95 par
   job, temps de mur d'une exécution de *pull request*, jobs par exécution.
2. **La matrice de compilation en parallèle.** `decoratorModes` compile tous les modes d'un
   coup au premier `load`, ou les cinq fichiers de *spec* sont découpés par compilateur ; le
   fichier le plus long passe sous 20 s. Indicateur : le fichier le plus long, et le temps de
   mur de l'exécution unitaire sur 20 cœurs et sur 4 vCPU.
3. **Un portable prend la moitié des cœurs, et pousse après les tests `related`.**
   `maxWorkers: '50%'` hors *pipeline* dans le `vitest.config.ts` racine, comme les configs
   générées le font déjà ; le *hook* de *pre-push* exécute `affected-packages.mjs --base
   origin/main` et les *specs* unitaires de ces *packages* sans couverture, l'exécution complète
   avec couverture laissée au *pipeline*. Indicateurs : pic de mémoire de l'arbre de processus,
   temps de mur avant un *push*.
4. **Le lint et la vérification des types.** ESLint avec `--cache --cache-strategy content`, le
   cache restauré depuis le cache du *pipeline* par une clé du *lockfile* et de la config
   ESLint avec un repli par préfixe ; `typecheck:tests` comme une solution `tsc -b` ou 25 projets
   à la fois plafonnés aux cœurs. Indicateurs : temps de mur du job de lint et du job de
   typecheck, parité des constats.
5. **Le cache d'installation.** Sa clé sur le *lockfile*, l'OS, l'architecture et la ligne de
   Node ; les *packages* construits gardés tels quels. Indicateur : taux de succès du cache et
   taille du cache.
6. **Les familles lourdes exécutent deux fichiers à la fois, et leurs géants d'un seul fichier
   sont coupés.** Écrite d'abord comme deux *shards* du job unitaire, quand ce job prenait
   9,5 min ; après la deuxième ligne il prend 6 à 8 min, et les jobs les plus longs du tronc sont
   les projets générés sur npm (13 min : quatre fichiers l'un après l'autre), les *shards* de
   bout en bout (11 à 13 min) et les exécutions de l'alias (12 min : 35 *stacks* dans un seul
   fichier). Un second *shard* du job unitaire ajouterait un job à la file sans rien raccourcir.
   À la place : les projets générés et les exécutions de l'alias prennent deux fichiers à la
   fois (`VITEST_MAX_WORKERS=2` pour l'exécution et pour les *specs* de chaque projet généré,
   qui se partagent alors les quatre cœurs deux par deux ; un projet s'installe depuis npm
   pendant qu'un autre exécute ses *specs*), `alias-runtime.spec.ts` coupé en deux fichiers de
   la moitié des *stacks* chacun, et n'importe quel port libre pour une application que les
   *specs* démarrent, pour que deux ne se rencontrent jamais sur le même. Les *shards* de bout
   en bout restent à un fichier à la fois : leurs fichiers exécutent les *specs* de projets
   générés sous couverture, qui expirent à cinq secondes quand deux projets se partagent quatre
   cœurs (vu sur un *shard*) ; ils sont équilibrés sur les secondes mesurées par les *runners*
   à la place (505 à 521 s par *shard* contre 352 à 715 s). Indicateur inchangé : temps de mur
   du job le plus long du tronc, mesuré sur une machine tenue à quatre cœurs (section 5) et sur
   les exécutions du *pipeline*.
7. **Deux essais, non bloquants et mesurés pendant un mois** : Oxlint avec tsgolint et les
   règles du kit comme *plugin* JS, ses constats comparés à ceux d'ESLint à chaque exécution,
   en commençant par la raison pour laquelle le *plugin* casse sous cette API (une règle qui
   lit quelque chose que l'alpha ne porte pas), signalée en amont ou contournée dans le
   *plugin* ; les jobs unitaires et de bout en bout sur `ubuntu-26.04-arm` aux exécutions de
   nuit, leurs p50 comparés aux exécutions x64. Chacun finit par un verdict écrit sur cette
   page.

Ce que ce plan ne fait pas : il n'ajoute aucun outil qu'un contributeur doive apprendre, aucun
démon, aucun cache distant avec un secret, et il garde toute la matrice sur le tronc et la nuit,
ce qui rend la sélection sûre.

## Ce qu'un projet généré reçoit

Les projets que `ddd-ts-kit init` écrit tiennent déjà les leviers de cette page qui comptent
pour une équipe : la moitié des cœurs hors *pipeline*, `ddd-ts-kit affected` sur les contextes
qu'une branche atteint avant un *push* et sur une *pull request*, le lint des fichiers indexés
au *commit*, un job porte qui lit tous les autres. Ce que cette étude ajoute à leurs
*templates*, dans le même ordre : le cache par contenu d'ESLint dans le *template* du
*pipeline*, et les indicateurs de cette page dans le README du *pipeline*, pour qu'une équipe
mesure avant de changer d'outil. Aucun orchestrateur n'est ajouté aux *templates*, pour les
raisons ci-dessus.

## Reste à vérifier

- Les constats d'Oxlint avec les règles du kit comme *plugin* JS contre ceux d'ESLint, sur cet
  arbre et sur un projet généré, sur plusieurs semaines de changements : le job d'essai de #256
  les écrit dans le résumé de chaque exécution du tronc et de la nuit.
- Le cache par contenu d'ESLint dans les *templates* d'un projet généré.
- Le p50 des jobs unitaires et de bout en bout sur des *runners* arm64 contre x64, sur dix
  exécutions de nuit.
- Le rappel de la sélection de bout en bout par *stack* : un changement de *template* qui
  atteint une *stack* que la sélection n'a pas nommée est un bug de la sélection, attrapé par
  l'exécution de nuit et consigné ici.
- Le gain d'`experimental.recordDependencies` sur la sélection `related`, une fois listées les
  *specs* qui lisent des *fixtures* avec `fs`.
- TypeScript 7.1 : la mémoire de `tsc -b` et l'API qui permet à typescript-eslint d'utiliser le
  compilateur natif, ce qui change l'arithmétique du lint.

## Sources

Mesures de ce dépôt : les scripts de la méthode ne sont pas conservés dans le dépôt ; les
chiffres sont ceux du 2026-10-23, reproductibles avec `/usr/bin/time -v` et l'API de GitHub
Actions (`gh api repos/<owner>/<repo>/actions/runs/<id>/jobs`).

Compilateurs :

- Annonce et tableaux de TypeScript 7.0 : https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- Bêta de TypeScript 7.1 : https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/
- VS Code sur TypeScript 7 : https://code.visualstudio.com/blogs/2026/06/26/iterating-faster-with-ts-7
- Prisma sur TypeScript 7 : https://www.prisma.io/blog/typescript-7-native-compiler-faster-type-checking
- typescript-eslint et le compilateur natif : https://github.com/typescript-eslint/typescript-eslint/issues/10940

*Linters* :

- typescript-eslint, performance du lint typé : https://typescript-eslint.io/troubleshooting/typed-linting/performance/
- ESLint, lint multi-*threads* : https://eslint.org/blog/2025/08/multithread-linting
- Le cache d'ESLint en artefact de *pipeline*, 54 s à 2,4 s : https://github.com/arcboxlabs/linkcode/pull/312
- Oxlint, lint typé stable : https://oxc.rs/blog/2026-07-22-type-aware-linting-stable
- Oxlint, *plugins* JS en alpha : https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha
- Oxlint, Biome et ESLint mesurés sur une même base de code : https://dev.to/fabwaseem/oxlint-vs-biome-vs-eslint-in-2026-benchmarked-on-a-real-nextjs-codebase-3lal
- Une migration vers Oxlint dans un monorepo Nx : https://www.udaynayak.com/blog/migrating-from-eslint-prettier-to-oxlint-oxfmt-in-an-nx-monorepo
- Biome v2 et son inférence de types : https://biomejs.dev/blog/biome-v2/

*Runners* de tests :

- Vitest, améliorer la performance : https://vitest.dev/guide/improving-performance
- Vitest 5 : https://vitest.dev/blog/vitest-5
- Vitest, `recordDependencies` : https://vitest.dev/config/experimental
- Vitest, désactiver l'isolation : https://main.vitest.dev/guide/recipes/disable-isolation
- *Workers* contre vCPU sur une machine à 4 vCPU : https://github.com/vitest-dev/vitest/issues/5668
- *Sharding* de Vitest dans le *pipeline* (Contentstack) : https://developers.contentstack.com/blog/the-waiting-tax-on-every-pr-how-sharding-vitest-cut-ci-from-15-minutes-to-4-5
- Fichiers de *spec* découpés comme entrées atomiques de *shard* (NVIDIA) : https://github.com/NVIDIA/NemoClaw/pull/8320
- Astro sur node:test : https://astro.build/blog/node-test-migration/

Orchestrateurs et gestionnaires de *packages* :

- Sentry, le seul tableau indépendant avant et après : https://blog.sentry.io/reduce-ci-time-with-nx-caching/
- Radar technologique de Porsche Digital sur Nx : https://opensource.porsche.com/porschedigital-technology-radar/tools/nx/
- Trilium Notes, le départ de Nx : https://docs.triliumnotes.org/developer-guide/architecture/adr
- Nx, tâches atteintes : https://nx.dev/docs/features/ci-features/affected
- Nx, la vulnérabilité CREEP : https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep
- Nx, *packages* de cache auto-hébergé dépréciés : https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages
- L'incident s1ngularity : https://github.com/nrwl/nx/security/advisories/GHSA-cxm3-wv7p-598c
- Turborepo, `run` et `--affected` : https://turborepo.dev/docs/reference/run
- moon, sélection : https://moonrepo.dev/docs/concepts/affected
- *Benchmarks* de pnpm (vendeur) : https://pnpm.io/benchmarks ; filtrage : https://pnpm.io/filtering
- Sélection prédictive de tests, le vocabulaire du rappel (Facebook) : https://ar5iv.arxiv.org/html/1810.05286

GitHub Actions :

- Limites : https://docs.github.com/en/actions/reference/limits
- *Runners* : https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- Cache : https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/caching-dependencies-to-speed-up-workflows
- *Runners* arm64 et x64 mesurés : https://runs-on.com/reference/benchmarks
- Filtres de chemins et contrôles requis : https://github.com/orgs/community/discussions/44490

## Voir aussi

- [L'analyse statique et le pipeline](../tools/static-analysis-and-pipeline.fr.md)
- [Base de qualité](../tools/quality-baseline.fr.md)
- [Lanceurs de tests : Vitest et Jest](../tools/test-runners.fr.md)
- [Isoler les agents de code](../guides/agent-sandbox.fr.md)
- [Travailler en parallèle sans collisions](../guides/parallel-work.fr.md)
- Le *pipeline* de ce dépôt : [pipeline/README.md](../../pipeline/README.md)
