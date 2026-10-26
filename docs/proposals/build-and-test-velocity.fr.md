[English](build-and-test-velocity.md) · **Français**
<!-- translation-of: build-and-test-velocity.md sha256:30ba2a98cd622a66 -->

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

## État (2026-10-23 ; les outils du projet oxc mesurés le 2026-10-26)

**Construit, lignes 1 à 7, en une journée ; deux essais courent pendant un mois.** Chaque ligne a
été une *pull request* à part, mesurée avant et après sur les indicateurs ci-dessous ; les
chiffres de la journée sont dans [Ce que la journée a mesuré](#ce-que-la-journée-a-mesuré). La
page française et celle-ci gardent l'étude telle qu'elle a été écrite, puis ce qu'elle est devenue.

| Partie | Verdict |
|---|---|
| 1. Moins de jobs par exécution du *pipeline*, les familles lourdes réduites sur une *pull request* | **construit** (#248) : cinq portes repliées en un job, la suite de l'alias sur une ligne de Node et les projets générés sur npm sur une *pull request* ; 24 jobs à 20 sur le tronc, 23 à 17 sur une *pull request* ; les *shards* de bout en bout et les exécutions de l'alias tenus aux *stacks* qu'un changement atteint sont venus avec la *pull request* #260 : un indicateur d'une *stack* qui nomme un *package* changé (un ORM, un *broker*, un cache, une file, un rapporteur, un *logger*, un stockage) la garde, un changement d'un *package* avec lequel chaque projet est construit les garde toutes, la première *stack* reste pour que chaque fichier exécute quelque chose |
| 2. La matrice de compilation de cinq fichiers de *spec* en parallèle | **construit** (#250) : les modes d'un fichier compilent quelques-uns à la fois, les six fichiers les plus longs démarrent en premier ; le fichier le plus long de 84 s à 27 s dans une exécution complète, le job unitaire du *pipeline* de 571 s à environ 490 s |
| 3. La moitié des cœurs hors *pipeline*, les *specs* des *packages* qu'une branche atteint avant un *push* | **construit** (#252) : l'étape unitaire du *hook* de 152 à 201 s et 9,3 à 11,5 Go, à 101 à 110 s et 6,8 à 7,3 Go sur une branche qui atteint tout, quelques secondes sur une feuille |
| 4. ESLint avec son cache par contenu, la vérification des types des *specs* en parallèle | **construit** (#253) : `npm run lint` de 36,5 s à 1,3 s quand rien n'a changé, le cache abandonné quand les règles du kit telles que construites, la config ou le *lockfile* ont changé (`pipeline/monorepo/lint.mjs`) ; le tronc écrit le cache du *pipeline*, une *pull request* le restaure ; `typecheck:tests` de 5,1 s à 3,3 s ; les projets qu'`init` écrit prennent le même cache dans `ddd-ts-kit lint` et dans leur job de lint avec la *pull request* #262 |
| 5. Le cache d'installation | **construit autrement** (#254) : la clé suivait déjà le *lockfile* et les manifestes qu'elle contient gardent le *lockfile*, donc la clé reste ; la moitié des 10 Go étaient les caches de *pull requests* fusionnées, supprimés désormais à la fermeture d'une *pull request* ; 10 052 Mo à 5 637 Mo le jour où le *workflow* est arrivé |
| 6. Les familles lourdes exécutent deux fichiers à la fois, leur géant d'un seul fichier coupé (réécrite : le job unitaire a cessé d'être le plus long après la ligne 2) | **construit** (#255) : les projets générés et les exécutions de l'alias deux fichiers à la fois avec deux *workers* chacun, `alias-runtime.spec.ts` en deux moitiés, les *shards* de bout en bout équilibrés sur des secondes mesurées (505 à 521 s chacun, de 352 à 715 s) ; sur quatre cœurs la famille *managers* de 521 s à 308 s ; deux fichiers à la fois a été essayé sur les *shards* aussi et a fait expirer les *specs* d'un projet généré : ils restent à un à la fois |
| 7. Oxlint avec tsgolint et les règles du kit comme *plugin* JS ; *runners* arm64 | **à l'essai** (#256) : la seule règle qui cassait sous l'API de *plugins* corrigée (#257 répare la règle *stepdown* sur les scripts, qu'Oxlint a révélée), `npm run lint:oxlint` 6 s et 1,0 Go contre 35 s et 3,0 Go, un job du tronc et de la nuit à côté d'ESLint ; les *specs* unitaires et le troisième *shard* de bout en bout sur `ubuntu-26.04-arm` la nuit ; verdicts après un mois. Mesuré de nouveau le 2026-10-26 ([Les outils du projet oxc](#les-outils-du-projet-oxc-mesurés-le-2026-10-26)) : le *plugin* tourne entier sur cet arbre et les règles natives sont à parité (1 197 constats sur 1 197 sur un corpus, trois constats vrais de plus), mais trois règles du kit lisent ce qu'Oxlint ne donne pas à un *plugin* JS (les types, le *parser*), et `clean-no-commented-out-code`, active dans ce dépôt, ne rapporte rien sous lui : pas la porte avant la correction du *plugin* |
| Oxfmt, tsdown, oxc-transform, le cache de modules de Vitest gardé dans le *pipeline* | **pas maintenant** (2026-10-26) : le contrôle du format prend 0,33 s, le build 2 s et s'exécute une fois par état des sources, le cache de modules fait gagner 5 % de toute la suite unitaire ; rien à gagner contre un reformatage, des déclarations perdues ou un cache de 122 Mo |
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

Oxlint lit tout l'arbre en 2 s et ses règles typées en 4 s, contre 35 s pour ESLint : la
vitesse rapportée par les autres équipes tient ici. Les constats, non : avec les règles de
typescript-eslint et d'ESLint seules, 16 à 17 constats apparaissent qu'ESLint ne rapporte pas,
une règle à désactiver (`no-redeclare`) et trois à examiner ; avec les règles du kit chargées
par l'API de *plugins* JS, qui est en alpha, le *plugin* casse sur 2 494 des fichiers et la
règle *stepdown* rapporte 43 constats qu'ESLint ne rapporte pas. La parité des constats n'y est
pas, et tant que le *plugin* ne tourne pas entier sous cette API, Oxlint ne peut pas être la
porte d'un projet qui utilise le kit. Il peut tourner à côté d'ESLint, sans bloquer, pour
mesurer l'écart à mesure que l'API mûrit.

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
   page. L'essai d'Oxlint continue comme le dit le plan de
   [Les outils du projet oxc](#les-outils-du-projet-oxc-mesurés-le-2026-10-26) : le *plugin*
   corrigé d'abord, puis les constats comparés, puis la porte.

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

## Les outils du projet oxc, mesurés le 2026-10-26

L'oxc-project (VoidZero) publie une famille d'outils en Rust pour JavaScript et TypeScript : Oxlint
et son moteur typé tsgolint, le formateur Oxfmt, le transformateur `oxc-transform` avec ses
déclarations isolées et, sur Rolldown, le *bundler* de bibliothèques tsdown ; Vite 8, sous
Vitest 5, transforme déjà avec Oxc. Cette section mesure chacun contre l'outil qu'il remplacerait
dans ce dépôt et dans les projets qu'`init` écrit, sur les indicateurs de la méthode : la parité
des constats d'abord (un outil plus rapide qui ne fait pas le même travail n'est pas candidat),
puis le temps de mur, le temps CPU et le pic de mémoire. Rien n'est adopté ici : le plan de la fin
liste les *pull requests* qui le feraient.

### Où le *pipeline* passe son temps

Médianes de 17 exécutions du 2026-10-24 au 2026-10-26 (sept du tronc, huit *pull requests*, deux
nuits), par job, en secondes de *runner*, lues dans l'API de GitHub Actions :

| Job | Tronc | *Pull request* | Nuit |
|---|---|---|---|
| Tests de bout en bout, les quatre *shards* ensemble | 3 494 | 3 450 | 2 953 |
| Projet généré sur npm, sur pnpm | 840, 568 | 865, non exécuté | 824, 597 |
| Tests unitaires, Node 24 avec couverture, Node 22 | 651, 627 | 450, 330 | 612, 473 |
| Alias d'import à l'exécution, Node 22, Node 24 | 445, 385 | non exécuté, 533 | 464, 490 |
| Application d'exemple | 400 | 397 | 358 |
| Intégration, architecture, chaque règle cassée une fois | 204, 189, 171 | 29, 183, 175 | 196, 166, 139 |
| Contrôles statiques (vérification des types 24 s, *pack* 51 s, site 31 s) | 137 | 138 | 141 |
| **Lint** (ESLint 70 s sur le tronc, qui écrit son cache ; contrôle du format 2 s) | **97** | **38** | **77** |
| Essai, Oxlint à côté d'ESLint (Oxlint lui-même 13 s) | 38 | non exécuté | 33 |
| Installation et build (le build restauré de son cache) | 33 | 33 | 23 |
| **Une exécution entière** | **environ 8 300** | **environ 7 700** | **7 500 à 11 800** |

Le lint et le contrôle du format de ce dépôt font 1,2 % d'une exécution du tronc et 0,5 % d'une
exécution de *pull request*, et le build s'exécute une fois par état des sources, chaque autre
job le restaurant. Environ 6 300 des 8 300 secondes d'une exécution du tronc vont aux familles
qui génèrent des projets et exécutent leur porte (installation, compilateur, ESLint, Biome,
*specs* avec couverture, vérificateur, graphe, code mort). Un outil plus rapide raccourcit le
*pipeline* là où il tourne dans ces projets, ce qui est la partie 5, plus que dans les jobs du
dépôt lui-même ; sur une station de travail, il raccourcit ce qu'une personne ou un agent attend.

### Méthode du jour

La station de travail de l'étude (20 cœurs, 32 Go, Linux 6.8), Node 24.22.1, npm 11.19.1.
Versions : ESLint 10 et typescript-eslint 8 tels que verrouillés, Oxlint 1.89.0 avec
oxlint-tsgolint 7.0.2005 (TypeScript 7.0.2 à l'intérieur), @oxlint/migrate 1.89.0, Biome 2.6.2,
Oxfmt 0.74.0, TypeScript natif 7.0.2, TypeScript 6.0.3, oxc-transform 0.155.0, tsdown 0.23.2 sur
Rolldown 1.2.15, Vitest 5.0.5 sur Vite 8.3.4 et Rolldown 1.2.13. Chaque commande a tourné sous
`nice`, une à la fois, trois fois, cinq quand la charge moyenne de la dernière minute dépassait 4
juste avant (la suite unitaire entière : trois exécutions quelle que soit la charge, ses propres
*workers* la font monter) ; les tableaux donnent le minimum et la médiane du temps de mur, la
médiane du temps CPU (utilisateur et système, `/usr/bin/time`) et la médiane du pic de mémoire
de tout l'arbre de processus, la mémoire résidente de chaque processus sous la commande, sommée
toutes les 200 ms depuis `/proc`. Une commande de moins de 200 ms échappe à cet échantillonnage :
son pic est alors celui que `/usr/bin/time` donne pour son seul processus principal (`%M`), le
plus grand des deux étant gardé. La machine était partagée avec d'autres sessions d'agents de code
(charge de 0,7 à 17 avant une exécution, chacune notée) ; un chiffre mesuré sous une charge n'est
comparé qu'à un chiffre mesuré sous une charge semblable. Les outils que le dépôt n'installe pas
ont tourné depuis le cache de `npx -y <package>@<version exacte>`, ce qui laisse le dépôt intact.
Les exécutions brutes sont dans [build-and-test-velocity-oxc.csv](build-and-test-velocity-oxc.csv)
(le code de sortie d'une commande enveloppée dans `sh -c '...; true'` est celui de l'enveloppe).

### 1. Oxlint et tsgolint contre ESLint et typescript-eslint

**Ce qu'il remplace.** ESLint, typescript-eslint et les règles du kit, chargées comme *plugin*
JS : `npm run lint`, le job Lint et l'étape ESLint du *hook* de *pre-commit* ici ;
`ddd-ts-kit lint` et son job dans un projet généré.

**Parité.** Quatre arbres, les mêmes règles des deux côtés.

| Arbre | ESLint | Oxlint | Même fichier, ligne et règle | Oxlint seul |
|---|---|---|---|---|
| ce dépôt, la porte telle que configurée (6 084 fichiers) | 3 | 6 | 3 | 3 |
| les 1 326 fichiers de *spec* sous les règles non typées des sources, un corpus à constats | 1 197 | 1 199 | 1 197 | 2 |
| la copie de l'exemple, intacte, le *preset* du kit (985 fichiers) | 0 | 345 | 0 | 345 |
| la même avec chaque règle du catalogue cassée une fois, `naming-business-name` désactivée dans Oxlint | 89 | 97 | 86 | 11 |

- **Ce dépôt.** Le *plugin* du kit tourne désormais entier sous l'API de *plugins* JS (il cassait
  sur 2 494 fichiers le 2026-10-23, avant #257). Les trois constats qu'ESLint ne rapporte pas sont
  vrais : `no-unsafe-optional-chaining` deux fois sur `(x?.y as T)['200']` dans deux *specs*, où
  Oxlint voit à travers l'assertion de type et la règle de base d'ESLint non, et `unbound-method`
  une fois sur `(this.options.follow ?? followWithFetch)(request)` dans `packages/testing`, où
  `follow` est déclarée comme méthode : l'appel perd son `this`, et typescript-eslint le manque.
- **Le corpus.** Les règles non typées des sources (les règles `clean-*` du kit, la mise en page de
  `@stylistic`, `complexity`, `max-depth`, le jeu strict de typescript-eslint) appliquées aux
  *specs*, qui n'y sont pas tenues : 755 `clean-stepdown`, 225 `clean-no-escape-hatch`, 173
  `clean-function-size`, 22 `complexity`, 13 `consistent-type-imports` et 9 autres, chacun au
  même endroit dans les deux outils, aux deux mêmes `no-unsafe-optional-chaining` près.
- **L'exemple, où la parité casse.** La suite de conformité casse chaque règle du catalogue une
  fois dans une copie de l'exemple ; la même copie, passée aux deux outils dans les mêmes tours,
  dit ce que le corpus ne pouvait pas dire :
  - `naming-business-name` lit les types par `getParserServices`, qu'un *plugin* JS d'Oxlint ne
    reçoit pas : la règle lève une exception, et l'exception arrête **toutes les règles du kit**
    sur le fichier. Sur la copie intacte, cela fait 303 fichiers sur 985 où aucune règle du kit
    ne tourne, et 50 des 77 injections qu'ESLint rapporte manquées.
  - `clean-no-commented-out-code` et `language-declared-vocabulary` analysent du texte avec
    `context.languageOptions.parser`, qu'Oxlint ne transmet pas : elles ne rapportent rien, en
    silence. `clean-no-commented-out-code` est active dans ce dépôt aussi ; un fichier sonde avec
    `// const doubled = value * 2;` reçoit le constat d'ESLint et aucun d'Oxlint.
  - `consistent-type-imports` d'Oxlint ne connaît pas `emitDecoratorMetadata`, que les projets en
    `--dependencies signature` activent : 41 constats sur la copie intacte et 10 de plus dans les
    tours, tous faux (les paramètres du constructeur sont lus à l'exécution ; sa correction
    casserait le câblage).
  - Avec `naming-business-name` désactivée, 74 des 77 injections qu'ESLint rapporte le sont par
    les deux, 86 des 89 constats au même endroit ; les manques sont les trois règles ci-dessus.

**Ce qui diffère dans la configuration.** La parité tient une fois que la configuration dit la
même chose, ce que l'outil de migration ne fait pas seul :

- `@oxlint/migrate` ne sait pas exprimer un bloc dont les `files` se combinent avec les `files`
  d'une configuration qu'il étend (16 avertissements « AND glob patterns » ici) : il abandonne
  quatre règles des sources (`no-var`, `prefer-const`, `prefer-rest-params`, `prefer-spread`) et
  laisse actives treize règles de base que typescript-eslint désactive parce que le compilateur
  les vérifie (`constructor-super`, `no-dupe-keys`, `no-unreachable` et dix autres). Le
  `.oxlintrc.json` versionné a les deux écarts, et il lui manque l'exclusion de
  `packages/audit/test/generated/`. Le *preset* d'un projet généré n'a pas cette imbrication, et
  ses jeux de règles concordent.
- Non implémentée : `@typescript-eslint/no-unsafe-enum-assignment` (dans `strictTypeChecked`).
  `no-octal` et `no-dupe-args` sont des erreurs de syntaxe dans un module et n'ont pas besoin de
  règle.
- Dans la *nursery* d'Oxlint (inactives sauf si nommées) : `no-unnecessary-condition` (typée,
  dans `typedCleanCode` du kit), `no-useless-assignment`, `no-undef`. Nommées, elles ne rapportent
  rien sur ce dépôt, comme ESLint ; sur un fichier sonde, `no-unnecessary-condition` a trouvé ses
  deux fautes et `no-useless-assignment` a manqué celle qu'elle devait rapporter.
- `no-undef` d'Oxlint ne traite pas un fichier `.cjs` comme du CommonJS : sur un projet généré,
  elle rapporte `module` dans `.dependency-cruiser.cjs` ; un `env` `commonjs` pour `**/*.cjs` le
  règle.
- Oxlint n'a pas de cache, et n'en a pas besoin à ces temps-là.

**Coût sur la station de travail :**

| Exécution | Mur min / médiane | CPU | Pic de mémoire |
|---|---|---|---|
| ESLint, tout le dépôt, sans cache (`eslint .`) | 35,7 / 36,4 s | 58,5 s | 3,0 Go |
| ESLint, cache par contenu, rien de changé (`npm run lint`) | 1,16 / 1,17 s | 1,7 s | 0,39 Go |
| ESLint, cache par contenu, un fichier source changé | 1,65 / 1,69 s | 2,8 s | 0,50 Go |
| Oxlint, tout le dépôt, typé, règles du kit comme *plugin* JS (`npm run lint:oxlint`) | 5,75 / 5,85 s | 20,2 s | 1,63 Go |
| Oxlint, typé, règles natives seules | 2,39 / 2,45 s | 14,7 s | 1,33 Go |
| Oxlint, non typé, avec le *plugin* JS | 3,42 / 3,50 s | 6,2 s | 0,45 Go |
| Oxlint, non typé, règles natives seules | 0,07 / 0,08 s | 0,7 s | 0,29 Go |
| les 13 fichiers d'un *commit* typique (#405), ESLint comme le *hook* de *pre-commit* l'exécute (sans cache) | 1,62 / 1,63 s | 3,5 s | 0,50 Go |
| les mêmes, Oxlint typé avec le *plugin* JS | 0,82 / 0,82 s | 2,8 s | 0,29 Go |
| le corpus des *specs*, ESLint / Oxlint, non typé, *plugin* du kit | 5,59 / 5,61 s, 1,67 / 1,69 s | 10,3 s, 3,5 s | 0,79 Go, 0,39 Go |

Lecture : sans cache, Oxlint est six fois plus rapide qu'ESLint et prend la moitié de sa mémoire ;
de ses 5,9 s, 3,4 s sont le *plugin* du kit qui tourne en JavaScript et 2,4 s les règles typées,
les règles natives seules prenant 80 ms. Avec son cache par contenu, ESLint répond sur une station
de travail en 1,2 à 1,7 s, plus vite qu'Oxlint : le gain est sur une exécution à froid (un
*worktree* neuf, une configuration ou un *lockfile* changés, le job du tronc qui écrit le cache :
70 s d'ESLint contre 13 s d'Oxlint sur le même *runner*) et dans le *hook* de *pre-commit*
(0,8 s par *commit*).

**Verdict pour ce dépôt : pas encore ; essayer en CI une fois que le *plugin* tourne entier.** Sur
les règles qu'Oxlint porte nativement, la parité est atteinte (1 197 sur 1 197 sur le corpus, trois
constats vrais de plus sur l'arbre), ce que l'étude du 2026-10-23 ne pouvait pas dire. C'est le
*plugin* du kit qui l'arrête : une règle qui lève une exception sans les types et deux qui ne
rapportent rien sans *parser*, dont une active dans ce dépôt. Le gain, une fois cela corrigé, est
faible pour le *pipeline* (environ 57 s d'une exécution du tronc, 0,7 %) et réel sur une station
de travail à froid (36 s, 58 s CPU et 3,0 Go à 6 s, 20 s CPU et 1,6 Go).

### 2. Oxfmt contre le formateur de Biome

**Ce qu'il remplace.** `biome format` : le contrôle du format du job Lint et du *hook* de
*pre-commit*, `npm run format`. Le *linter* de Biome est désactivé dans ce dépôt.

**Parité.** `oxfmt --migrate=biome` reprend la largeur 120, les guillemets simples, les virgules
finales, les points-virgules et les parenthèses autour des paramètres des fonctions fléchées. Sur
les 7 171 fichiers que Biome formate (6 985 `.ts`), Oxfmt en réécrirait 73 : 30 `package.json`
dont il trie les champs par défaut (`sortPackageJson`, désactivable), et 43 fichiers TypeScript sur
314 lignes où Oxfmt imprime comme Prettier et Biome autrement : un en-tête de classe avec un long
`implements` (11 endroits), un dernier argument qui est une fonction fléchée avec un type de
retour, collé (12), une longue liste d'exports remise sur une ligne, une chaîne de membres coupée,
le `; )` d'une clause `for` vide. Rien qui change le code : un reformatage unique de 43 fichiers,
puis un style qui suit Prettier plutôt que Biome. Par défaut, il formate aussi le Markdown, le
YAML et les autres fichiers que Biome laisse (18 fichiers d'un projet généré, son README parmi
eux).

| Exécution | Mur min / médiane | CPU | Pic de mémoire |
|---|---|---|---|
| Biome 2.6.2, contrôle du format du dépôt | 0,33 / 0,33 s | 5,1 s | 0,24 Go |
| Oxfmt 0.74.0, les mêmes 7 171 fichiers | 0,13 / 0,13 s | 1,1 s | 0,21 Go |
| Biome / Oxfmt, un projet généré (`init`, 82 `.ts`) | 0,04 / 0,05 s, 0,03 / 0,04 s | 0,1 s, 0,1 s | 0,05 Go, 0,18 Go |

**Verdict : pas maintenant.** Oxfmt est 2,5 fois plus rapide et dépense un cinquième du CPU sur
une étape d'un tiers de seconde, 2 s d'un job du *pipeline* : rien à gagner, un reformatage à
payer, une bêta (0.x depuis février 2026) au lieu d'une 2.x. À regarder de nouveau si le contrôle
du format devient une étape lente, ou une fois qu'Oxlint est le *linter* et qu'une seule chaîne
d'outils veut dire un outil de moins.

### 3. Le build : tsdown et oxc-transform contre le compilateur natif

**Ce qu'ils remplaceraient.** `tsc -b` des 26 *packages*, qui vérifie les types et écrit le
JavaScript, les déclarations et les *maps*, et `pipeline/monorepo/add-extensions.mjs`, qui écrit
les `.js` que les sources omettent.

| Exécution | Mur min / médiane | CPU | Pic de mémoire | Ce qu'il ne fait pas |
|---|---|---|---|---|
| `npm run build` depuis zéro, 26 *packages* | 1,99 / 2,01 s | 14,1 s | 0,93 Go | |
| `npm run build`, rien à faire | 0,24 / 0,25 s | 0,4 s | 0,13 Go | |
| `add-extensions` seul | 0,08 / 0,08 s | 0,1 s | 0,06 Go | |
| `tsc -b packages/kernel` depuis zéro, 644 fichiers | 0,19 / 0,19 s | 1,0 s | 0,17 Go | |
| tsdown, le *kernel* non regroupé, déclarations par TypeScript 6 | 2,07 / 2,09 s | 4,4 s | 0,75 Go | vérification des types ; écrit des `.mjs` et `.d.mts` |
| tsdown, le *kernel* non regroupé, sans déclarations | 0,21 / 0,22 s | 0,9 s | 0,28 Go | déclarations, vérification des types |
| oxc-transform, les 4 582 sources, JavaScript et déclarations isolées | 0,41 / 0,41 s | 0,5 s | 0,08 Go | vérification des types, `.js` dans les imports ; 305 erreurs de déclarations |
| oxc-transform, JavaScript seul | 0,28 / 0,28 s | 0,3 s | 0,08 Go | déclarations, vérification des types, `.js` dans les imports |

Lecture : le compilateur natif construit le *kernel* en 0,19 s avec sa vérification des types ;
tsdown n'est pas plus rapide sans déclarations et onze fois plus lent avec, car son *plugin* de
déclarations appelle l'API JavaScript de TypeScript 6 (TypeScript 7 n'en a pas encore).
oxc-transform écrit tout l'arbre en 0,4 s sur un cœur, mais ses déclarations demandent
`isolatedDeclarations`, que 183 fichiers sources enfreignent 298 fois (`tsc --isolatedDeclarations` :
des types de retour et de propriétés explicites manquent, TS9010 115 fois, TS9013 113), il ne
vérifie aucun type, si bien qu'un `tsc --noEmit` reste à côté, et il laisse les imports sans
extension tels quels.

**Verdict : pas maintenant, rien à gagner.** Le build coûte 2 s depuis zéro et un quart de seconde
quand rien n'a changé ; changer d'outil échangerait les déclarations ou la vérification des types
contre au plus une seconde et demie, une fois par état des sources dans le *pipeline*. À regarder
de nouveau si un *package* doit livrer un *bundle*, ou quand TypeScript 7.1 donnera à tsdown une
voie native pour les déclarations.

### 4. Vitest sur Vite 8 : ce que la transformation d'Oxc donne déjà

Les configurations Vitest du dépôt et des projets générés ne fixent aucune transformation :
Vitest 5.0.5 tourne sur Vite 8.3.4, qui transforme avec Oxc et regroupe avec Rolldown ; il ne reste
ni esbuild ni SWC à remplacer. Essayé à côté des *pools* et de l'isolation que l'étude a déjà
écartés :

| Réglage | Mur min / médiane | CPU | Pic de mémoire |
|---|---|---|---|
| `vitest run packages/kernel` (59 fichiers, la moitié des cœurs), le cache de modules de Vitest chaud (`experimental.fsModuleCache`, actif par défaut) | 7,38 / 7,40 s | 79,1 s | 4,3 Go |
| le même, ce cache vidé avant chaque exécution | 11,78 / 11,93 s | 84,5 s | 4,4 Go |
| le même, ce cache désactivé | 11,54 / 11,74 s | 84,8 s | 4,3 Go |
| le même, quatre *workers*, chaud / froid, sous la même charge | 7,14 / 7,18 s, 11,77 / 11,82 s | 67,3 s, 73,9 s | 4,1 Go, 3,9 Go |
| `deps.optimizer.ssr.enabled`, cache chaud | 7,31 / 7,42 s | 79,0 s | 4,3 Go |
| `vitest run packages/http` (47 fichiers), chaud / froid | 4,00 / 4,05 s, 5,10 / 5,42 s | 48,8 s, 56,4 s | 1,9 Go, 2,1 Go |
| toute la suite unitaire (844 fichiers), chaud / froid | 118,5 / 122,2 s, 123,4 / 129,5 s | 1 610 s, 1 620 s | 6,7 Go, 7,4 Go |
| `experimental.viteModuleRunner: false` (le *loader* de Node) | échoue | | |

Lecture : la transformation d'Oxc tourne dans le processus principal, qui nourrit chaque *worker* ;
sur un petit *package*, le cache de modules de Vitest 5 fait gagner 38 % du temps de mur (le
*kernel*, chaud et froid sous la même charge ; 25 % sur http, froid sous une charge plus lourde) ;
sur toute la suite, où les *specs* elles-mêmes dominent (compilateurs enfants, PGlite), il fait
gagner 5 % du temps de mur et 1 % du CPU, pour un cache de 122 Mo. L'optimiseur de dépendances
n'apporte rien. Le *loader* de Node ne sait pas résoudre les imports sans extension des sources.
Sur une station de travail, le cache est déjà actif ; dans le *pipeline*, il est toujours froid,
car il vit dans `node_modules`, que le job d'installation sauvegarde avant qu'aucune *spec* ait
tourné.

**Verdict : rien à changer.** Garder ce cache dans le *pipeline* gagnerait environ 5 % d'un job
unitaire (quelque 30 s sur 650) pour 122 Mo de plus dans un cache de 10 Go déjà à moitié plein :
pas maintenant.

### 5. Ce qu'un projet généré reçoit

`init` écrit ESLint avec le *preset* du kit, Biome comme formateur, le compilateur natif et
Vitest. Mesurés : un projet d'`init --context billing:core --package-manager npm`, installé depuis
le registre (kit 0.92.0, 82 fichiers TypeScript), et l'application d'exemple (985 fichiers) comme
projet qui a grandi.

| Étape | Projet d'`init` | L'exemple |
|---|---|---|
| toute la porte (`npm run verify`, le lint depuis son cache) | 7,41 / 7,71 s, 14,0 s CPU, 1,3 Go | |
| ESLint, sans cache (le job d'un clone neuf, et chaque porte des familles de ce *pipeline*) | 2,89 / 3,05 s, 5,9 s CPU, 0,66 Go | 10,25 / 11,18 s, 19,1 s CPU, 1,2 Go |
| `ddd-ts-kit lint`, cache chaud | 1,07 / 1,10 s, 1,6 s CPU, 0,43 Go | |
| Oxlint, typé, le *preset* tel que migré | 1,00 / 1,01 s, 3,2 s CPU, 0,38 Go | 2,42 / 2,62 s, 7,3 s CPU, 0,87 Go (`naming-business-name` désactivée) |
| Oxlint, typé, règles natives seules | | 0,58 / 0,59 s, 3,7 s CPU, 0,72 Go |
| vérification des types | 0,23 s, 1,2 s CPU | 0,44 / 0,45 s, 3,0 s CPU, 0,49 Go |
| Biome, contrôle du format | 0,05 s | 0,10 s |
| *specs* avec couverture | 2,51 / 2,79 s, 5,5 s CPU, 1,3 Go | |

Lecture : un ESLint à froid fait le tiers de la porte d'un projet neuf et la plus grosse étape
statique d'un projet qui a grandi, 25 fois la vérification des types ; Oxlint le ferait passer de
3 s à 1 s et de 11 s à 2,6 s, avec 40 à 55 % du CPU et 60 à 70 % de la mémoire. Dans ce *pipeline*,
les familles de bout en bout exécutent la porte d'environ 35 projets d'échantillon, chacune à
froid, si bien que le gain serait de l'ordre d'une à cinq minutes de *runners* par exécution, au
plus 3 % ; dans le *pipeline* du projet d'un utilisateur, dont le job de lint lit le cache ESLint
de son tronc, il ne porte que sur les exécutions à froid.

**Verdict : pas maintenant.** La parité n'y est pas sur le *preset* (partie 1) : une règle du kit
qui arrête toutes les autres sur 303 fichiers sur 985, deux qui ne rapportent rien, une règle
native qui rapporte 41 faux constats sur les projets qui câblent par la signature du constructeur
et dont la correction les casserait. La CLI, le *guard* et `ddd-ts-kit lint` exécutent ESLint, et
le *plugin* est un *plugin* ESLint ; un second *linter* dans les *templates* est un choix qu'un
projet fait, après les corrections ci-dessous, pas un défaut.

### Verdicts, et le plan des *pull requests* qui suivent

| Outil | Remplace | Chiffre décisif | Verdict |
|---|---|---|---|
| Oxlint + tsgolint, règles du kit comme *plugin* JS, dans ce dépôt | ESLint + typescript-eslint | parité native 1 197 sur 1 197 ; mais `clean-no-commented-out-code` ne rapporte rien sous Oxlint ; 36 s à 6 s à froid, ESLint déjà à 1,2 s avec son cache | **pas encore : essayer en CI après la correction du *plugin*** |
| le même dans les projets qu'`init` écrit | le même | 74 injections sur 77, une règle qui arrête le *plugin* sur 303 fichiers sur 985, 41 faux `consistent-type-imports` | **pas maintenant ; une option après les corrections** |
| Oxfmt | le formateur de Biome | 0,33 s à 0,13 s sur une étape de 2 s dans le *pipeline* ; 43 fichiers reformatés | **pas maintenant** |
| tsdown, oxc-transform | `tsc -b` et `add-extensions` | build 2,0 s ; tsdown onze fois plus lent avec les déclarations ; 298 erreurs de déclarations isolées | **pas maintenant** |
| le cache de modules de Vitest gardé dans le *pipeline* | rien (un réglage) | 5 % de toute la suite pour 122 Mo | **pas maintenant** |
| l'optimiseur de dépendances, le *loader* de Node dans Vitest | | aucun gain ; échoue sur les imports sans extension | **non** |

Le plan, dans l'ordre ; chaque ligne est une *pull request*, mesurée avant et après sur les
indicateurs de cette page :

1. **Le *plugin* du kit tourne entier sous Oxlint.** `clean-no-commented-out-code` et
   `language-declared-vocabulary` analysent avec un *parser* à elles quand
   `context.languageOptions.parser` est absent ; `naming-business-name` se rabat sur les noms du
   code quand les services du *parser* sont absents, au lieu de lever une exception. Une *spec*
   exécute les règles du *plugin* sur les mêmes échantillons sous les deux *linters*. Gain : aucun
   à lui seul ; la condition du reste (77 injections sur 77 attendues).
2. **Le job d'essai compare, et la configuration d'Oxlint dit ce que dit celle d'ESLint.** Les
   quatre règles abandonnées rétablies, les treize de trop désactivées, les règles de la *nursery*
   nommées, `commonjs` pour les `.cjs`, l'exclusion manquante ; le job de nuit compare les
   constats des deux outils (fichier, ligne, règle) sur ce dépôt et sur la copie cassée de
   l'exemple, et écrit la différence dans son résumé, sans rien faire échouer. Gain : aucun ; il
   fait du verdict un chiffre.
3. **Oxlint comme porte de lint de ce dépôt**, après un mois de nuits sans différence :
   `npm run lint`, le job Lint et le *hook* de *pre-commit* sur Oxlint, ESLint gardé la nuit pour
   `no-unsafe-enum-assignment` et comme référence du *plugin*. Attendu : le job Lint du tronc de
   97 s à environ 40 s (une minute CPU par exécution du tronc), un lint à froid sur une station de
   travail de 36 s, 58 s CPU et 3,0 Go à 6 s, 20 s CPU et 1,6 Go, le *hook* de 1,6 s à 0,8 s par
   *commit*.
4. **Oxlint comme option d'`init`**, si le mainteneur veut un second *linter* dans les
   *templates* : le *preset* écrit aussi pour Oxlint, `consistent-type-imports` désactivée là où le
   projet câble par la signature du constructeur, une paire de la matrice de support pour lui.
   Attendu : le lint à froid d'un projet de 3 s à 1 s, d'un projet qui a grandi de 11 s à 2,6 s
   (19 à 7 s CPU, 1,2 à 0,9 Go).
5. Oxfmt, tsdown, oxc-transform et le cache de modules de Vitest dans le *pipeline* restent
   dehors ; cette section est le chiffre auquel se comparer quand l'un d'eux change.

### Résultats du plan : points 1 et 2 (branche `fix/oxlint-plugin-whole`)

**Point 1, le *plugin* tourne entier.** Trois changements dans `packages/eslint-plugin` :
`naming-business-name` demande les services du *parser* dans un `try` et lit les noms du code quand
le *linter* n'en offre aucun ; quatre règles qui analysent un texte à elles
(`clean-no-commented-out-code`, `language-declared-vocabulary`, `authz-declared`,
`ports-implements-never-extends`) prennent le *parser* de typescript-eslint quand la
configuration n'en donne aucun. Le *parser* qu'Oxlint remet à ses *plugins* JS dans
`languageOptions.parser` est une doublure nommée `oxlint` dont `parse` lève « not implemented yet » :
elle est traitée comme l'absence de *parser*, ce qui explique que le premier essai (prendre
`languageOptions.parser` quand il existe) manquait encore deux règles. Une *spec* du paquet exécute
trois règles sur un fichier sous ESLint et sous Oxlint et les compare. La mesure est celle de
l'étude, le harnais de la suite de conformité (chaque injection par tours sur une copie de l'exemple,
les deux outils, les mêmes fichiers) :

| Copie de l'exemple, 115 fichiers en 7 tours | Avant | Après |
|---|---|---|
| fichiers où aucune règle du kit n'a tourné (`fatal`) | 303 sur 985 | 0 |
| constats sur la copie intacte | 345 (303 `fatal`, 41 `consistent-type-imports`, 1 `no-undef`) | 42 (41 `consistent-type-imports`, 1 `no-undef`) |
| injections qu'ESLint rapporte et qu'Oxlint rapporte aussi, `naming-business-name` activée | 27 sur 77 | **77 sur 77** |
| idem, `naming-business-name` désactivée | 74 sur 77 | 77 sur 77 (la règle n'a plus à être coupée) |
| constats des tours, ESLint / Oxlint / au même endroit | 89 / 108 / 29 | 89 / 100 / **89** |
| constats d'Oxlint seul | 68 `fatal`, 11 `consistent-type-imports` | 11 `consistent-type-imports` |
| constats d'ESLint seul | 60 | 0 |

Ce qui reste est hors du *plugin* : `consistent-type-imports` d'Oxlint ignore
`emitDecoratorMetadata` (41 sur la copie intacte, 11 dans les tours, tous faux) et `no-undef` lit un
`.cjs` comme un module ; les deux relèvent du point 4, le *preset* Oxlint d'un projet généré.

**Point 2, la configuration et la comparaison.** `.oxlintrc.json` retrouve les quatre règles
(`no-var`, `prefer-const`, `prefer-rest-params`, `prefer-spread`, sur les sources et les tests),
désactive les quinze règles du noyau que typescript-eslint coupe pour TypeScript (l'étude en
comptait treize ; lues dans `eslint --print-config` d'un fichier source, ce sont `constructor-super`,
`getter-return`, `no-class-assign`, `no-const-assign`, `no-dupe-class-members`, `no-dupe-keys`,
`no-func-assign`, `no-import-assign`, `no-new-native-nonconstructor`, `no-obj-calls`,
`no-setter-return`, `no-this-before-super`, `no-unreachable`, `no-unsafe-negation`, `no-with`),
ajoute l'exclusion de `packages/audit/test/generated/` et coupe `no-unused-vars` sur les scripts
comme ESLint. Oxlint a alors rapporté trois constats vrais qu'ESLint ne fait pas (deux
`no-unsafe-optional-chaining` sur `(x?.y as T)['200']` dans des *specs* de `packages/http`, un
`unbound-method` sur `(this.options.follow ?? followWithFetch)(request)` dans `packages/testing`) ;
ils sont corrigés dans le code, pour que les deux outils disent la même chose sur cet arbre. Le job
d'essai lance les deux outils avec leur sortie JSON et `pipeline/monorepo/compare-linters.mjs`
écrit dans son résumé les totaux et chaque constat qu'un seul côté fait, par fichier, ligne et
règle, `no-unsafe-enum-assignment` mis à part comme attendu. Il reste hors de la porte
(`continue-on-error`, non requis par le job de porte) ; l'exécution d'ESLint du job est à froid,
ce qui ajoute environ 70 s à un job de 38 s qui ne tourne que sur le tronc et la nuit. La
comparaison sur la copie cassée de l'exemple n'est pas en CI : elle demande toute la suite de
conformité (un *build* de chaque paquet et une configuration Oxlint générée pour l'exemple, que le
migrateur écrit et que le dépôt ne garde pas), environ 40 s sur une station ; la mesure ci-dessus en
est la trace.

| Ce dépôt, 6 084 fichiers | ESLint | Oxlint | Au même endroit | Oxlint seul |
|---|---|---|---|---|
| avant (la porte telle que configurée le 2026-10-26) | 3 | 6 | 3 | 3 |
| après | 3 | 3 | **3** | 0 |

### Résultats du plan : point 3, le job Lint d'une pull request sous Oxlint

La condition (aucune différence avec ESLint sur ce dépôt, fichier, ligne et règle) tient : 3 constats
de chaque côté, 3 au même endroit, `no-unsafe-enum-assignment` seule règle qu'ESLint a et
qu'Oxlint n'a pas, et elle ne rapporte rien ici. Le job Lint d'une *pull request* lance maintenant la
vérification du format et `npm run lint:oxlint` ; le tronc et la nuit lancent ESLint sur tout
l'arbre, comme avant, sans le cache (que seules les *pull requests* lisaient). `npm run lint` reste
ESLint avec son cache par contenu. Mesuré sur la station de l'étude, sous `nice`, une commande à la
fois, charge moyenne de la dernière minute avant chaque exécution :

| Exécution | Charge | Durée min / médiane | CPU (médiane) | Mémoire de pointe (médiane) |
|---|---|---|---|---|
| `npm run lint`, cache par contenu d'ESLint, rien de changé (3 exécutions) | 4,4 ; 3,4 ; 3,3 | 1,22 / 1,24 s | 1,75 s | 0,38 Go |
| `npm run lint:oxlint`, tout le dépôt, avec types, *plugin* du kit (3 exécutions) | 3,0 à 3,2 | 5,86 / 5,93 s | 20,3 s | 1,55 Go |
| `eslint .`, sans cache, ce que lance le tronc (3 exécutions) | 2,6 à 3,1 | 36,9 / 37,2 s | 59,5 s | 3,0 Go |

À lire : face à une *pull request* qui trouve son cache, Oxlint n'est pas plus rapide : 5,9 s contre
1,2 à 1,7 s de lint (le job dure 38 s en médiane, mise en place comprise). Ce que le changement
apporte, c'est que la *pull request* ne dépend plus du cache : la première après un changement de la
configuration, du *lockfile* ou d'une règle du kit (le cache est alors abandonné) lint tout l'arbre en
6 s d'Oxlint au lieu de 37 à 70 s d'ESLint, et le job perd ses deux étapes de cache. Le job du tronc,
qui écrit le cache, est inchangé à environ 97 s, donc pas d'économie des 57 s que le plan attendait
là : le tronc garde ESLint comme référence. Le temps final du job Lint d'une *pull request* est estimé à
ses 38 s actuelles moins la restauration du cache, plus environ 4 s : aucun changement mesurable quand
le cache est trouvé, 30 à 60 s de moins quand il ne l'est pas.

### Résultats du plan : point 4 de la demande, le *hook* de pre-commit sous Oxlint

Le *hook* lint les fichiers indexés avec `oxlint --type-aware --no-error-on-unmatched-pattern` au
lieu d'ESLint (l'option est nécessaire : Oxlint sort en code 1 quand tous les fichiers donnés sont
ignorés, un *commit* de *templates* seuls, puis lint le répertoire courant, ce qui coûte une
exécution et ne fait rien échouer). Les 13 fichiers d'un *commit* typique (#405), cinq exécutions
chacun car la charge moyenne dépassait 4 :

| Exécution | Charge | Durée min / médiane | CPU (médiane) | Mémoire de pointe (médiane) |
|---|---|---|---|---|
| ESLint, `--no-warn-ignored`, sans cache (le *hook* d'avant) | 4,6 à 4,8 | 1,66 / 1,70 s | 3,71 s | 0,48 Go |
| Oxlint, avec types, *plugin* du kit (le *hook* maintenant) | 4,4 à 4,7 | 0,79 / 0,81 s | 2,80 s | 0,29 Go |

Le *hook* est deux fois plus rapide, sur les mêmes fichiers et avec la même parité que le job Lint.

## Reste à vérifier

- Les constats d'Oxlint avec les règles du kit comme *plugin* JS contre ceux d'ESLint, sur cet
  arbre et sur un projet généré, sur plusieurs semaines de changements : le job d'essai de #256
  les écrit dans le résumé de chaque exécution du tronc et de la nuit. Le 2026-10-26, les
  règles natives étaient à parité et trois règles du kit ne l'étaient pas (voir le plan de la
  section sur le projet oxc) ; la comparaison est à refaire sur la copie cassée de l'exemple une
  fois le *plugin* corrigé.
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
Actions (`gh api repos/<owner>/<repo>/actions/runs/<id>/jobs`). Ceux du 2026-10-26 sont dans
[build-and-test-velocity-oxc.csv](build-and-test-velocity-oxc.csv), une ligne par exécution.

Le projet oxc, lu le 2026-10-26 :

- Oxlint, *plugins* JS (alpha ; pas de règles typées, pas de *parsers* personnalisés) : https://oxc.rs/docs/guide/usage/linter/js-plugins.html
- Oxfmt, le formateur (la sortie de Prettier comme base, environ 30 fois Prettier et 2 fois Biome, « vendeur ») : https://oxc.rs/docs/guide/usage/formatter.html
- Oxfmt bêta (2026-02-24 ; 100 % des tests de conformité JavaScript et TypeScript de Prettier, `--migrate biome`, `package.json` trié par défaut) : https://oxc.rs/blog/2026-02-24-oxfmt-beta
- Vite 8 (2026-03-12 ; Rolldown et Oxc à la place d'esbuild et de Rollup) : https://vite.dev/blog/announcing-vite8
- Les versions d'oxlint 1.89.0, oxfmt 0.74.0 et @oxlint/migrate 1.89.0 (2026-10-19), oxlint-tsgolint 7.0.2005 (2026-10-22), oxc-transform 0.155.0 (2026-10-19), tsdown 0.23.2 (2026-10-23), Rolldown 1.2.15 (2026-10-21) : le registre npm (`npm view <package> time`)

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
