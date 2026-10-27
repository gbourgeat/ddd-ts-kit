[English](test-runners.md) · **Français**
<!-- translation-of: test-runners.md sha256:e8228f37a28e43e0 -->

# Lanceurs de tests : Vitest et Jest

**Résumé.** L'approche des tests du kit (des *fakes* au lieu de *mocks*, des *builders*, des
suites de contrat, quatre niveaux de tests) ne dépend pas d'un lanceur : les utilitaires n'en
importent aucun, et les suites de contrat prennent les fonctions du lanceur en argument. Il faut
tout de même en choisir un. Vitest est le défaut, et c'est sur lui que reposent le *pipeline*
propre au kit, les seuils de couverture et les preuves de bout en bout. Jest est pris en charge
par le générateur avec une configuration plus étroite. Cette page compare les deux pour ce genre
de projet et dit exactement ce que chaque choix vous donne.

## Ce que le lanceur doit faire ici

Un contexte de l'application scheduling a des *specs* à plusieurs niveaux (voir la
[stratégie de test](../concepts/testing-strategy.fr.md) et la section 7 de la
[référence de l'architecture](../ARCHITECTURE.fr.md)) :

- `Appointment` refuse une seconde annulation : une *spec* pure du domaine, des millisecondes ;
- `CancelAppointment` par le bus de commandes en mémoire avec des *fakes* : des millisecondes ;
- le *repository* des rendez-vous face à PostgreSQL, tenu au contrat des *repositories* : des
  secondes ;
- `POST /appointments` de bout en bout par HTTP et le bus d'événements : des secondes.

![Les quatre niveaux de specs d'un contexte : une spec du domaine et une spec de gestionnaire s'exécutent dans le projet unit en millisecondes, une spec d'adaptateur face à PostgreSQL s'exécute dans le projet integration en secondes, une spec de bout en bout par HTTP s'exécute avec sa propre configuration ; l'exécution unit mesure les couches domaine, application et présentation, l'exécution integration mesure l'infrastructure](../assets/diagrams/test-runners-four-levels.fr.svg)

Le lanceur doit donc exécuter du TypeScript écrit en modules ES, gérer les décorateurs (le style
déclaré en place un sur les gestionnaires et les adaptateurs), séparer *specs* rapides et lentes,
et mesurer la couverture par couche. Il n'a pas besoin d'un système de *mocks* : `test/no-mocks`
les décourage. Au lieu d'un *mock* qui vérifie un appel :

```ts
// contexts/notification/test/unit/send-reminder.handler.spec.ts : signalé par test/no-mocks
const mailer = { deliver: vi.fn() };
await new SendReminderHandler(mailer).execute(reminder);
expect(mailer.deliver).toHaveBeenCalledWith('ada@example.test', expect.anything()); // lie la spec à l'appel
```

écrivez un *fake* qui implémente le port, et vérifiez le résultat. Rien dedans n'appartient à un
lanceur, sauf `it` et `expect` :

<!-- checked sample -->
```ts
import { expect, it } from 'vitest';

// application/ports/mailer.port.ts et le gestionnaire testé, réduits à ce qu'utilise la spec
abstract class Mailer {
  abstract deliver(address: string, subject: string): Promise<void>;
}
class SendReminderHandler {
  constructor(private readonly mailer: Mailer) {}

  async execute({ address, startsAt }: { address: string; startsAt: Date }): Promise<void> {
    await this.mailer.deliver(address, `Reminder: your appointment at ${startsAt.toISOString()}`);
  }
}

// test/fakes/in-memory-mailer.ts : un fake implémente le port et garde ce qu'on lui a donné
class InMemoryMailer implements Mailer {
  readonly sent: { address: string; subject: string }[] = [];

  async deliver(address: string, subject: string): Promise<void> {
    this.sent.push({ address, subject });
  }
}

it('reminds the client of the appointment', async () => {
  const mailer = new InMemoryMailer();

  await new SendReminderHandler(mailer).execute({ address: 'ada@example.test', startsAt: new Date('2026-03-02T09:00:00Z') });

  expect(mailer.sent).toEqual([{ address: 'ada@example.test', subject: 'Reminder: your appointment at 2026-03-02T09:00:00.000Z' }]);
});
```

Sous Jest, la même *spec* importe `expect` et `it` depuis `@jest/globals` ; le reste ne change
pas.

## Comparaison

Versions et licences lues sur npm le 2026-10-10.

| | Vitest | Jest |
|---|---|---|
| Version, licence | 5.0.3, MIT | 30.5.2, MIT |
| TypeScript | pris en charge d'emblée, par les transformateurs de Vite | demande un transformateur (`babel-jest` avec votre configuration Babel par défaut) : le *template* du kit utilise `@swc/jest` |
| Modules ES | « ESM first », selon ses propres mots | expérimental, selon les propres mots de Jest, par l'option `--experimental-vm-modules` de Node, que passent les scripts générés |
| Décorateurs | abaisse lui-même les décorateurs legacy et non les standard (TC39), qui demandent le *plugin* du kit (comme l'indique le README de testing et comme l'exercent les suites du kit ; introuvable sur vitest.dev) | ce que fait le transformateur : le *template* du kit règle `@swc/jest` sur le mode du projet, legacy avec métadonnées (class-validator, NestJS) ou standard (`decoratorVersion: '2022-03'`) |
| Projets (unit et integration séparés) | oui, utilisé par le kit | oui, comme fonction de Jest (`projects`) ; non utilisé par le *template* du kit |
| Couverture | fournisseur `v8`, `istanbul` ou personnalisé ; seuils par motif glob, utilisés par le kit | fournisseur `babel` (par défaut) ou `v8` ; `coverageThreshold` global, par glob ou par chemin ; le *template* du kit le fixe par `governedJestCoverage()` à partir de `ddd-ts-kit.config.json`, par contexte et par couche, en une seule exécution |
| Mode surveillance (watch) | relance les tests liés à un changement en parcourant le graphe des modules | `--watch` relance les tests liés aux fichiers modifiés, ce qui demande un dépôt git ou hg et un graphe de dépendances statique ; `--watchAll` relance tout |
| Globales | importées de `vitest` | importées de `@jest/globals` dans les *specs* générées |
| Écosystème (un jugement, pas un fait mesuré) | plus récent, aligné sur Vite | plus ancien, beaucoup de suites existantes |

Les lignes consacrées aux fonctionnalités ont été lues le 2026-10-10 dans la documentation de Vitest 5.0.3
(https://vitest.dev/guide/features , https://vitest.dev/config/coverage) et de Jest 30.5
(https://jestjs.io/docs/configuration , https://jestjs.io/docs/ecmascript-modules ,
https://jestjs.io/docs/cli). La ligne des décorateurs pour Vitest et la ligne de l'écosystème ne
viennent pas de ces pages et sont marquées comme telles.

La vérification des types n'est faite par aucun des deux : tous deux retirent les types. Le
compilateur s'en charge, dans sa propre porte.

## Vitesse, mesurée

Mesuré le 2026-10-27 sur un poste de travail (Intel Core i7-12700H, 20 processeurs logiques,
31 Go, Linux, Node.js 24.22.1). Chaque paire de projets est le même projet deux fois, à `--tests`
près : kit 0.97.0 installé depuis npm, Vitest 5.0.3 (5.0.5 dans l'exemple), Jest 30.5.2 avec
`@swc/jest` 0.2.39 et `@swc/core` 1.16.20, les configurations qu'écrit `init`, la couverture par
le fournisseur `v8` des deux côtés.

| Projet | Fichiers de *specs* | Tests | Décorateurs |
|---|---|---|---|
| `init --context billing:core` | 2 | 51 | standard |
| `init --context billing:core --preset identity` | 60 (dont 9 sur PGlite) | 295 | standard |
| l'exemple scheduling, ses *specs* portées sous Jest (plus bas) | 283 (dont 32 sur PGlite) | 1 549 | legacy, avec métadonnées |

L'exemple a été porté en ne changeant que le lanceur : les 283 fichiers de *specs* importent
`describe`, `it`, `expect` et les *hooks* depuis `@jest/globals` au lieu de `vitest`, et
`jest.config.js` est celui que le *template* écrit pour le mode legacy des décorateurs. Les deux
exécutions passent les mêmes 1 549 tests. Les *specs* de bout en bout, qui ne tournent pas dans le
job unitaire, ont été laissées de côté.

Comment c'est mesuré : chaque lanceur démarré directement, comme le démarre le script `test` du
projet (`vitest run` ; `node --experimental-vm-modules node_modules/jest/bin/jest.js`), une
commande à la fois, Vitest et Jest en alternance, sous `nice`. Les *workers* tels que les
configurations générées les fixent sur un poste, la moitié des processeurs logiques (10). « À
froid » vide d'abord le cache du lanceur (`node_modules/.vite`, le `cacheDirectory` de Jest) ; « à
chaud » le garde. « 4 CPU, CI » est la même exécution avec `CI=1` sur quatre processeurs logiques
(deux cœurs et leurs *hyperthreads*, `taskset`), la taille d'un *runner* hébergé, où chaque
lanceur choisit son nombre de *workers*. Chaque chiffre est la médiane de 3 à 5 exécutions (2 pour
les exécutions à froid de l'exemple) ; l'exécution la plus lente et la plus rapide d'une série
sont à moins de 8 % l'une de l'autre, 10 % pour Jest avec couverture sur quatre CPU (193 à
212 s). Le CPU est le temps utilisateur plus système de tout l'arbre de processus ; la mémoire est
le pic de la mémoire résidente additionnée de l'arbre, qui compte plusieurs fois les pages
partagées : comparez-la d'une colonne à l'autre, pas avec la mémoire d'une machine. Une exécution
pendant laquelle d'autres processus de la machine ont pris plus d'un CPU en moyenne a été écartée
et reprise.

**L'exemple (283 fichiers)**

| Exécution | Vitest | Jest |
|---|---|---|
| toutes les *specs*, à chaud | 25,4 s, 373 s CPU, 7,8 Go | **18,1 s**, 260 s CPU, 8,8 Go |
| toutes les *specs*, à froid | 24,7 s, 361 s CPU, 7,1 Go | **21,2 s**, 314 s CPU, 11,2 Go |
| *specs* unitaires seules, à chaud | 12,8 s, 170 s CPU | **8,9 s**, 120 s CPU |
| *specs* d'intégration seules (PGlite), à chaud | 11,6 s, 180 s CPU | **10,4 s**, 148 s CPU |
| toutes les *specs* avec couverture, à chaud | **29,5 s**, 417 s CPU, 7,6 Go | 47,9 s, 563 s CPU, 9,3 Go |
| un fichier de *spec*, à chaud | 0,42 s | 0,35 s |
| toutes les *specs*, 4 CPU, CI | 74,3 s, 275 s CPU | **56,4 s**, 206 s CPU |
| toutes les *specs* avec couverture, 4 CPU, CI | **85,3 s**, 312 s CPU | 201,3 s, 665 s CPU |

**Le *preset* identity (60 fichiers)**

| Exécution | Vitest | Jest |
|---|---|---|
| toutes les *specs*, à chaud | 6,3 s, 69 s CPU, 8,9 Go | **4,8 s**, 70 s CPU, 7,9 Go |
| toutes les *specs*, à froid | 10,2 s, 74 s CPU | **5,5 s**, 72 s CPU |
| *specs* unitaires seules, à chaud | 3,6 s, 41 s CPU | **2,8 s**, 23 s CPU |
| *specs* d'intégration seules (PGlite), à chaud | 3,4 s, 28 s CPU | 3,4 s, 45 s CPU |
| toutes les *specs* avec couverture, à chaud | 7,2 s, 75 s CPU, 9,0 Go | **6,4 s**, 74 s CPU, 6,2 Go |
| un fichier de *spec*, à chaud | 1,30 s | **0,48 s** |
| toutes les *specs*, 4 CPU, CI | 16,8 s, 58 s CPU | **11,4 s**, 41 s CPU |
| toutes les *specs* avec couverture, 4 CPU, CI | **18,6 s** | 19,8 s |

**Un nouveau projet (2 fichiers) :** 2,1 s pour les deux sans couverture, à froid comme à chaud ;
avec couverture, 2,4 s sous Vitest et 2,7 s sous Jest. En dessous d'une dizaine de fichiers, le
démarrage du lanceur est toute l'exécution.

Ce que disent les chiffres :

- **Sans couverture, Jest est ici le plus rapide des deux :** 24 à 29 % de temps en moins à chaud
  sur les deux projets les plus gros, et 30 à 45 % de CPU en moins sur les *specs* unitaires. Un
  poste qui lance les *specs* pendant qu'il travaille a ses résultats plus tôt sous Jest.
- **Avec couverture, l'ordre s'inverse sur un projet qui a grandi :** sur le *preset* identity, les
  deux restent proches (Jest 6,4 s contre 7,2 sur le poste, Vitest 18,6 s contre 19,8 sur quatre
  CPU),
  mais sur l'exemple Vitest prend 29,5 s contre 47,9 s, et 85 s contre 201 s sur quatre CPU. Le
  coût vient du fournisseur `v8` de Jest : la même exécution Jest avec le fournisseur `babel` prend
  20,5 s, et 64,7 s sur quatre CPU, plus vite que Vitest dans les deux cas (plus bas). Le
  *pipeline* que reçoit un projet lance ses *specs* avec couverture (`ci:test:unit`) : sur un
  *runner*, le job unitaire de l'exemple, tel que généré, est plus rapide sous Vitest.
- **Un démarrage à froid coûte à Vitest dans le mode standard des décorateurs :** 10,2 s contre
  6,3 s à chaud sur le *preset* identity, car le *plugin* `decorators()` compile une fois chaque
  fichier décoré (voir les limites plus bas) ; l'exemple, en mode legacy, n'a pas besoin de ce
  *plugin* et tourne aussi vite à froid qu'à chaud. Un *pipeline* qui ne garde pas `node_modules/.vite` paie
  le chiffre à froid.
- **Les *specs* d'intégration mesurent le *template* autant que le lanceur.** Le *template* Vitest
  démarre PostgreSQL dans le processus une fois par exécution et chaque *spec* en ouvre une copie
  (une mise en place globale, `test/support/test-database-template.ts`) ; le *template* Jest en
  démarre un par fichier de *spec*. Sur le *preset* identity, cela coûte à Jest 45 s de CPU contre
  28 pour le même temps écoulé ; la même exécution Jest, avec le modèle de Vitest en
  `globalSetup`, a pris 3,1 s et 26 s de CPU. L'exemple ouvre sa base de la même façon sous les
  deux lanceurs.
- **Un fichier, la boucle d'un développeur :** moins d'une demi-seconde des deux côtés pour un
  fichier de l'exemple ; 1,3 s sous Vitest contre 0,5 s sous Jest sur le *preset* identity, très
  probablement le *plugin* de décorateurs de Vitest qui démarre pour ce seul fichier : sur
  l'exemple, qui n'en a pas, l'écart est de 0,07 s.

**Fournisseurs de couverture.** Chaque lanceur en a deux ; les mêmes exécutions, à chaud, avec ce
que chacun rapporte pour tout le projet. Tous les fournisseurs ont tenu les seuils des deux
projets, sauf `istanbul` sur l'exemple.

| Fournisseur | Exemple | *Preset* identity | Instructions, branches rapportées (exemple ; identity) |
|---|---|---|---|
| Vitest `v8` (le *template*) | 29,5 s, 418 s de CPU | 7,2 s | 99,6 %, 95,3 % de 637 ; 99,0 %, 94,4 % de 234 |
| Vitest `istanbul` | 26,1 s, 369 s de CPU, échoue sur un seuil | 8,4 s | 99,7 %, 91,3 % de 699 ; 99,0 %, 94,4 % de 234 |
| Jest `v8` (le *template*) | 48,0 s, 562 s de CPU | 6,5 s | 98,1 %, 97,6 % ; 99,0 %, 97,5 % |
| Jest `babel` | **20,6 s**, 286 s de CPU | **6,4 s**, 85 s de CPU | 99,6 %, 95,3 % ; 98,7 %, 94,4 % |

Sur quatre CPU avec `CI=1`, à chaud : l'exemple prend 85,3 s sous Vitest `v8`, 201,3 s sous Jest
`v8` et **64,7 s** sous Jest `babel` ; le *preset* identity 18,6, 19,8 et **16,4 s**. Le
fournisseur `babel` de Jest rapporte les mêmes branches que le `v8` de Vitest ; le `v8` de Jest
rapporte deux à trois points de branches couvertes de plus que les deux autres, si bien qu'un seuil
fixé sur lui peut échouer après un changement de fournisseur. Le `istanbul` de Vitest compte 62
branches de plus sur l'exemple, en mode legacy des décorateurs, et un dossier passe sous son
seuil (75 % contre 80).

**Workers.** L'exemple, à chaud, sans couverture, avec `--maxWorkers` imposé (les configurations
générées prennent la moitié des CPU logiques sur un poste, 10 ici) :

| Workers | Vitest | Jest |
|---|---|---|
| 1 | 114,9 s, 1,5 Go | 111,7 s, 3,5 Go |
| 2 | 60,7 s, 2,1 Go | 49,2 s, 4,3 Go |
| 4 | 35,6 s, 3,8 Go | 26,5 s, 5,4 Go |
| 10 (le défaut ici) | 25,4 s, 8,0 Go | 18,2 s, 8,8 Go |
| 20 | 23,9 s, 15,4 Go | 19,1 s, 17,0 Go |

Sur un seul *worker*, les deux lanceurs prennent le même temps : l'avance de Jest apparaît avec
les *workers* en parallèle. Au-delà de la moitié des CPU logiques (les *hyperthreads*),
l'exécution gagne 1,5 s sous Vitest, perd 0,9 s sous Jest, et double la mémoire. Le chiffre à un
*worker* est une seule exécution ; les autres sont la médiane de deux.

**Autres réglages du lanceur**, l'exemple, à chaud, sans couverture, les 1 549 tests passant dans
chaque cas :

| Réglage | Vitest | Jest |
|---|---|---|
| tel que généré (`forks`, isolé ; processus enfants) | 25,4 s, 373 s de CPU | 18,1 s, 260 s de CPU |
| `--pool=threads` | 20,1 s, 256 s de CPU | |
| `--no-isolate` | **12,1 s**, 180 s de CPU | |
| `--workerThreads` | | 17,2 s, 217 s de CPU |

**La boucle d'un développeur.** Les *specs* liées à un fichier modifié (`vitest related --run
<fichier>`, `jest --findRelatedTests <fichier>`) : les deux lanceurs choisissent les mêmes
fichiers dans le graphe des imports.

| Fichier modifié de l'exemple | *Specs* choisies | Vitest | Jest |
|---|---|---|---|
| `calendar.aggregate.ts` | 47 fichiers, 356 tests | 5,3 s | 4,7 s |
| `slot.vo.ts` (un *value object* utilisé dans tout le contexte) | 83 fichiers, 558 tests | 8,7 s | 7,5 s |
| un filtre qui ne trouve aucun fichier | 0 | 0,20 s | 0,25 s |

Le démarrage seul de l'un ou l'autre lanceur prend un cinquième de seconde : les 1,3 s d'un
fichier sous Vitest sur le *preset* identity viennent de la configuration de ce projet (le
*plugin* de décorateurs, les deux projets), pas du démarrage du lanceur.

**Un *pipeline* qui ne garde aucun cache**, quatre CPU, `CI=1`, avec couverture, à froid contre à
chaud :

| Projet | Vitest `v8` | Jest `v8` | Jest `babel` |
|---|---|---|---|
| exemple, à froid | 85,2 s | 260,2 s | 89,4 s |
| exemple, à chaud | 85,3 s | 201,3 s | 64,7 s |
| *preset* identity, à froid | 22,5 s | 21,8 s | 20,3 s |
| *preset* identity, à chaud | 18,6 s | 19,8 s | 16,4 s |

Le cache de transformation de Jest vaut 25 à 59 s sur l'exemple ; celui de Vitest ne vaut quelque
chose que dans le mode standard des décorateurs (4 s sur le *preset* identity).

**Installation.** `npm ci` du nouveau projet avec un cache npm chaud : 4,5 s pour Vitest, 5,2 s
pour Jest ; `node_modules` pèse 563 Mo pour 743 paquets contre 620 Mo pour 1 015.

**Tests de mutation.** Stryker sur le *preset* identity, tel que `init` le configure, sous Vitest :
659 mutants, score de 85,0 %, 1 min 46 s, 1 621 s de CPU, 11,6 Go de mémoire additionnée au pic,
une exécution. Sous Jest, ce n'est pas mesuré.

Aucun lanceur ne gagne toutes les lignes : le choix reste une affaire des critères ci-dessous, la
vitesse pesant pour Jest sur les exécutions sans couverture et pour Vitest sur les exécutions
avec couverture d'un projet qui a grandi, tel que généré. Les réglages qui font bouger ces
chiffres sont dans la section suivante.

## Recommandations selon le cas, pour la vitesse

Chaque ligne est un réglage qu'un projet peut changer, avec le gain mesuré plus haut. Aucun ne
change le lanceur que le kit vérifie.

| Cas | Réglage | Gain mesuré | À surveiller |
|---|---|---|---|
| Projet Jest dont le *pipeline* lance la couverture (tout projet généré) | `coverageProvider: 'babel'` dans `jest.config.js` au lieu de `'v8'` | exemple de 48,0 à 20,6 s à chaud, de 201 à 65 s sur quatre CPU, de 260 à 89 s à froid ; *preset* identity de 19,8 à 16,4 s sur quatre CPU | les branches rapportées baissent de deux à trois points (97,6 à 95,3 % sur l'exemple) : relire les chiffres avant le prochain changement de seuil ; le *preset* identity prend 14 % de CPU en plus |
| Projet Jest avec des *specs* sur PGlite | démarrer PostgreSQL une fois dans un `globalSetup` et donner une copie à chaque *spec*, comme le fait le *template* Vitest (pas encore dans le *template* Jest) | *preset* identity de 45 à 26 s de CPU, de 3,4 à 3,1 s | les fichiers de mise en place et de démontage s'écrivent à la main |
| Projet Vitest avec couverture | garder `v8`, le fournisseur du *template* | `istanbul` est plus rapide de 3,4 s sur l'exemple, plus lent de 1,2 s sur le *preset* identity | `istanbul` compte plus de branches en mode legacy des décorateurs : un dossier de l'exemple échoue sur son seuil |
| Un poste de travail | garder le `maxWorkers: '50%'` généré | le doubler gagne 1,5 s sous Vitest et perd 0,9 s sous Jest, pour deux fois la mémoire (15 à 17 Go sur l'exemple) | sur une machine à court de mémoire, 4 *workers* prennent 36 s (Vitest) et 27 s (Jest) pour 4 à 5 Go |
| Vitest sur un poste, toute la suite souvent | `--pool=threads` | de 25,4 à 20,1 s, 31 % de CPU en moins | les *threads* partagent un processus : une *spec* qui appelle `process.chdir`, change `process.env` pour de bon ou charge un module natif se comporte autrement ; l'exemple passe |
| Vitest, la boucle locale | `--no-isolate` | de 25,4 à 12,1 s | les modules chargés par un fichier de *spec* restent pour les suivants du *worker* : une *spec* qui laisse un module dans un autre état (un registre, une horloge globale, un *mock* de module) en casse une autre, dans un ordre qui change d'une exécution à l'autre ; garder l'isolation dans le *pipeline* |
| Jest, toute la suite souvent | `--workerThreads` | de 18,1 à 17,2 s, 16 % de CPU en moins | Jest documente l'option comme expérimentale |
| Travailler sur un fichier | `vitest related --run <fichier>`, `jest --findRelatedTests <fichier>`, ou le mode *watch* | exemple de 25,4 à 5,3 s (Vitest), de 18,1 à 4,7 s (Jest) pour un agrégat | un fichier importé partout choisit un tiers de la suite |
| Un *pipeline* | garder le cache du lanceur entre deux exécutions : `node_modules/.vite` pour Vitest, le `cacheDirectory` de Jest (par défaut sous le dossier temporaire du système, donc à nommer dans la configuration pour le mettre en cache) | Jest 25 à 59 s sur l'exemple ; Vitest 4 s dans le mode standard des décorateurs, rien dans le mode legacy | une clé de cache sur le *lockfile* et la configuration, pour qu'une nouvelle transformation ne réutilise pas une sortie périmée |
| Moins de dix fichiers de *spec* | l'un ou l'autre lanceur | 2,1 s des deux côtés | le démarrage du lanceur est toute l'exécution |
| Tests de mutation | la nuit, comme livré, pas à chaque *push* | | 1 min 46 s et 11,6 Go de mémoire additionnée sur le *preset* identity, sous Vitest |

## Critères de choix

- **Ce que le kit prouve.** Les *stacks* que la CLI génère, exécute et passe au *lint* de bout en
  bout dans sa propre suite de tests sont des projets Vitest. Avec Jest, vous quittez ce chemin
  vérifié (détails plus bas).
- **Suites existantes.** Une organisation avec des milliers de *specs* Jest, des *presets*
  partagés et des personnes formées a une vraie raison de rester sur Jest.
- **Mode des décorateurs du projet.** Avec class-validator ou NestJS, le projet est dans le mode
  legacy des décorateurs et les deux lanceurs le gèrent. Dans le mode standard, Vitest a besoin
  d'une ligne de *plugin*, que la configuration générée contient ; le *template* Jest règle le
  mode standard dans les options de `@swc/jest`.
- **Portes de couverture par couche.** Les deux configurations lisent les seuils dans `ddd-ts-kit.config.json` (`governedCoverage`, `governedJestCoverage`). La porte Vitest est exécutée sur des projets générés par la suite de bout en bout de la CLI ; celle de Jest est écrite mais pas exécutée là, même si la suite exécute les *specs* d'une pile Jest (plus bas).
- **Vitesse.** Mesurée plus haut : Jest exécute les *specs* de ces projets plus vite sans
  couverture ; avec couverture telle que générée, Vitest est 1,6 à 2,4 fois plus rapide sur
  l'exemple, et les deux sont proches sur le *preset* identity (6,4 à 7,2 s à chaud). Jest avec
  le fournisseur de couverture `babel` est le plus rapide des trois sur les deux (recommandations
  plus haut).
- **Habitudes du framework.** La documentation et les générateurs de NestJS supposent Jest ;
  c'est une habitude, pas une contrainte, puisque les gestionnaires et les agrégats du kit se
  testent sans le framework.

## Ce que ce kit prend en charge et a vérifié

**Les parties indépendantes du lanceur** ([`@ddd-ts-kit/testing`](../../packages/testing/README.fr.md)) :

- les *builders*, les scénarios étant donné / quand / alors, `createTestBuses` et
  `InMemoryRepository` n'importent aucun lanceur ni aucune bibliothèque ;
- les suites de contrat de `@ddd-ts-kit/testing/contracts` (`repositoryContract`,
  `unitOfWorkContract`, `eventBusContract`, `outboxStoreContract`,
  `processedEventStoreContract`, `cacheContract`, `lockContract`, `rateLimiterContract`,
  `jobSchedulerContract`, `loggerContract` et les autres que liste son README) prennent
  `{ describe, it, expect, beforeEach }`, et `afterEach` quand il est donné, de l'appelant, et
  n'utilisent que `toBe` et `toEqual`, « which the globals of vitest and jest both provide »,
  selon les mots du README ;
- la règle contre les *mocks* nomme les fonctions `vi.*` et `jest.*` de la même façon.

Un port à vous reçoit un contrat de la même façon, sur la classe de base `ContractSuite`, et le
*fake* comme l'adaptateur réel y sont tous deux tenus, quel que soit le lanceur du projet :

![Une seule suite de contrat, écrite une fois contre l'interface ContractRunner, reçoit les fonctions du lanceur (Vitest ou Jest) et s'exécute deux fois : contre le fake dans l'exécution unit, et contre l'adaptateur réel dans l'exécution integration](../assets/diagrams/test-runners-contract-suite.fr.svg)

<!-- checked sample -->
```ts
import { ContractSuite, type Awaitable, type ContractRunner } from '@ddd-ts-kit/testing/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// application/ports/mailer.port.ts
export abstract class Mailer {
  abstract deliver(address: string, subject: string): Promise<void>;
  abstract deliveredTo(address: string): Promise<readonly string[]>;
}

// test/contracts/mailer.contract.ts : ce que tout Mailer doit faire, sans aucun lanceur importé
export function mailerContract(runner: ContractRunner, options: { name: string; create(): Awaitable<Mailer> }): void {
  new MailerSuite(runner, () => options.create()).describe(`${options.name} (mailer contract)`);
}

class MailerSuite extends ContractSuite<Mailer> {
  protected tests(): void {
    this.it('keeps what it delivered, per address', async () => {
      await this.subject.deliver('ada@example.test', 'Reminder');

      this.expect(await this.subject.deliveredTo('ada@example.test')).toEqual(['Reminder']);
      this.expect(await this.subject.deliveredTo('bob@example.test')).toEqual([]);
    });
  }
}

// test/fakes/in-memory-mailer.ts
class InMemoryMailer implements Mailer {
  private readonly sent = new Map<string, string[]>();

  async deliver(address: string, subject: string): Promise<void> {
    this.sent.set(address, [...(this.sent.get(address) ?? []), subject]);
  }

  async deliveredTo(address: string): Promise<readonly string[]> {
    return this.sent.get(address) ?? [];
  }
}

// test/unit/in-memory-mailer.contract.spec.ts : le lanceur remet ses fonctions
mailerContract({ describe, it, expect, beforeEach, afterEach }, { name: 'InMemoryMailer', create: () => new InMemoryMailer() });
```

La *spec* de l'adaptateur, sous `test/integration/`, appelle le même `mailerContract` avec un
`create` qui construit l'adaptateur réel. Sous Jest, la première ligne importe plutôt les cinq
fonctions depuis `@jest/globals` ; `ContractRunner` ne leur demande rien de plus.

**Avec Vitest (le défaut) :**

- `vitest.config.ts` avec les projets `unit` et `integration` et les seuils de couverture du
  fichier de configuration, par contexte et par couche (le domaine le plus haut,
  l'infrastructure le plus bas, cette dernière mesurée par l'exécution integration du
  *pipeline*), et les *specs* des contextes qu'une *pull request* n'atteint pas laissées à la
  branche par défaut (`unaffectedContexts()`). Réduit à ses parties, pour un projet dans le mode
  standard des décorateurs :

<!-- checked sample -->
```ts
// vitest.config.ts
import { governedCoverage } from '@ddd-ts-kit/testing/coverage';
import { decorators } from '@ddd-ts-kit/testing/vitest';
import { defineConfig } from 'vitest/config';

const INTEGRATION_SPECS = 'src/contexts/*/test/integration/**/*.spec.ts';

export default defineConfig(({ mode }) => ({
  // décorateurs standard, compilés par le compilateur du projet ; les legacy n'ont besoin d'aucun plugin
  plugins: [decorators({ compiler: '@typescript/native' })],
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.spec.ts'], exclude: [INTEGRATION_SPECS] } },
      { extends: true, test: { name: 'integration', include: [INTEGRATION_SPECS] } },
    ],
    // ce qui est mesuré et le plancher de chaque couche : lus dans ddd-ts-kit.config.json
    coverage: { provider: 'v8', reporter: ['text', 'cobertura', 'lcov'], ...governedCoverage(mode) },
  },
}));
```

- hors *pipeline* (pas de variable `CI`), les *specs* prennent la moitié des cœurs
  (`maxWorkers: '50%'`) : une machine de développement les partage avec l'éditeur et les agents
  de code. `VITEST_MAX_WORKERS` fixe un autre nombre, pour un bac à sable plafonné sous les cœurs
  de son hôte ;
- une configuration de bout en bout séparée qui démarre toute l'application sur un port libre,
  sur un PostgreSQL dans le processus, sauf si une URL de base de données est donnée ;
- des rapports JUnit et Cobertura pour GitLab, le rapporteur Actions pour GitHub ;
- `decorators()` de `@ddd-ts-kit/testing/vitest` pour les projets dans le mode standard des
  décorateurs : Vitest 5 n'abaisse pas les décorateurs standard, et une *spec* qui importe un
  fichier décoré s'arrêterait sur une erreur de syntaxe. Le *plugin* ne compile que les fichiers
  qui portent un décorateur, avec le compilateur du projet (TypeScript 7 natif compris, puisqu'il
  exécute le binaire), met le résultat en cache (environ 60 ms par fichier la première fois avec
  TypeScript 7, 220 ms avec TypeScript 6, rien ensuite, comme mesuré dans le README), garde les
  *source maps*, et s'efface dans le mode legacy. Il ne vérifie pas les types et ne touche pas
  aux `.tsx` ;
- les projets générés que la CLI prouve entièrement (*specs*, *specs* de bout en bout, build,
  vérifications de la documentation, *lint*, graphe des imports, code mort) sont listés dans le
  README de la CLI ; aucun n'y est décrit comme un projet Jest.

**Avec Jest (`init --tests jest`).** Ce qui suit a été lu dans un projet généré le
2026-10-10 :

- un `jest.config.js` qui utilise `@swc/jest`, avec les décorateurs compilés dans le mode du
  projet (legacy avec métadonnées, ou standard), la gestion des modules ES, l'alias d'import
  traduit et les contextes qu'une *pull request* n'atteint pas laissés de côté :

```js
// jest.config.js, tel que généré pour un projet dans le mode standard des décorateurs (réduit)
import { governedJestCoverage, unaffectedContexts } from '@ddd-ts-kit/testing/coverage';

export default {
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': ['<rootDir>/src/$1.ts', '<rootDir>/src/$1/index.ts'] }, // les "paths" de tsconfig.json, répétés
  testPathIgnorePatterns: ['/node_modules/', ...unaffectedContexts().map((directory) => `/${directory}`)],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript', decorators: true }, transform: { decoratorVersion: '2022-03' }, target: 'es2022' } }],
  },
  ...(process.env.CI ? {} : { maxWorkers: '50%' }), // half of the cores outside a pipeline
  coverageProvider: 'v8',
  ...governedJestCoverage(),
};
```

- un `jest.e2e.config.js` qui l'étend, avec un délai plus long et un seul *worker* ;
- `jest`, `@jest/globals`, `@swc/core` et `@swc/jest` en dépendances de développement ; les
  *specs* générées importent leurs globales depuis `@jest/globals` ;
- un seul script de test pour les *specs* unitaires et d'adaptateurs ensemble, lancé avec
  `node --experimental-vm-modules` : le script d'intégration du *pipeline* se contente d'afficher
  que les *specs* d'adaptateurs s'exécutent avec les *specs* unitaires ;
- `jest.config.js` avec le fournisseur de couverture `v8` et les seuils du fichier de
  configuration, par contexte et par couche, dans l'unique exécution que fait Jest
  (`npm run test:coverage`) ;
- des tests unitaires de la CLI vérifient que ces fichiers et la *stack* enregistrée sont
  produits. Aucune preuve n'a été trouvée qu'un projet Jest généré soit installé et exécuté par
  la suite de bout en bout propre au kit.

## Limites, et quand ne pas l'utiliser

**Vitest**

- Les décorateurs standard ont besoin du *plugin* ; l'oublier donne une erreur de syntaxe au
  premier import décoré, pas un message utile.
- Le *plugin* appelle le compilateur du projet une fois par fichier décoré quand le cache est
  froid : une première exécution en CI sans cache le paie pour chacun de ces fichiers.
- L'outillage autour d'une nouvelle version majeure peut être en retard : l'outil de test de
  mutation que le README du *pipeline* mesure n'exécutait aucun test par mutant sous Vitest 5
  jusqu'à sa version du 2026-10-23.

**Jest**

- Les modules ES reposent sur `--experimental-vm-modules`. La documentation de Node.js
  (v26.11.1, lue le 2026-10-10, https://nodejs.org/api/vm.html) qualifie `vm.Module`,
  `vm.SourceTextModule` et `vm.SyntheticModule` de « Stability: 1 - Experimental », et la page
  propre à Jest dit sa prise en charge d'ESM expérimentale ; simuler un module en ESM passe par
  `jest.unstable_mockModule`.
- `@swc/jest` a été publié pour la dernière fois en septembre 2025 (0.2.39 sur npm) ; il tourne
  avec Jest 30.5.2, que le *workspace* installe : la suite de bout en bout de la CLI exécute les
  *specs* d'un projet généré sur Jest dès sa première minute, et le *preset* identity sur NestJS,
  class-validator, Prisma et Jest, la pile de l'exemple de gestion des dépenses.
- Le *template* écrit le mode des décorateurs du projet dans `jest.config.js` quand le projet est
  généré : Jest ne lit pas `tsconfig.json`, si bien qu'un projet qui change plus tard son mode
  là-bas change aussi les options de `transform` de `jest.config.js`.
- Pas de séparation unit et integration : les *specs* tournent dans un seul projet Jest, avec
  60 secondes par test et par *hook* (`testTimeout`), comme Vitest en donne aux *hooks* qui ouvrent
  la base de test.
- Chaque fichier de *spec* qui touche la base démarre PostgreSQL dans le processus à partir de
  rien, là où le *template* Vitest le démarre une fois par exécution et donne une copie à chaque
  *spec* : le même temps écoulé sur le *preset* identity, 60 % de CPU en plus (mesuré plus haut).
- La couverture passe par le fournisseur `v8`, que fixe le *template* : sur l'exemple, elle fait
  passer une exécution de 18 à 48 s, et de 56 à 201 s sur quatre CPU, là où le fournisseur
  `babel` prend 21 et 65 s (mesuré plus haut).
- Un import sans terminaison peut nommer un dossier : chaque alias vise la source, puis la
  barrière du dossier (`['<rootDir>/src/$1.ts', '<rootDir>/src/$1/index.ts']`). Sur Prisma, le
  client qu'écrit `prisma generate` nomme ses propres modules en `.js`, ramenés à leurs sources
  (`'^(\\.{1,2}/.*)\\.js$': '$1'`).

**L'un comme l'autre**

- Un lanceur ne rend pas un test bon. Une *spec* qui vérifie des appels au lieu de résultats est
  aussi fragile sous Vitest que sous Jest.
- Ne mélangez pas les deux lanceurs dans un projet : deux configurations, deux chaînes de
  transformation et deux jeux de globales, sans rien y gagner.

## Recommandation selon la situation

| Situation | Choix |
|---|---|
| Nouveau projet | Vitest : le défaut, le chemin vérifié, seuils et rapports compris |
| Style déclaré dans le mode standard des décorateurs | Vitest avec le *plugin* `decorators()` |
| Projet NestJS ou class-validator (décorateurs legacy) | Vitest fonctionne sans le *plugin* ; Jest si l'outillage NestJS de l'équipe repose dessus |
| Base de code existante avec une grosse suite Jest qui adopte le kit | Jest, en ajoutant à la main la séparation des projets et les seuils ; ne planifiez une migration que si elle est rentable |
| Une bibliothèque ou un adaptateur publié pour d'autres | écrivez son contrat avec `ContractSuite`, pour que les consommateurs l'exécutent sous l'un ou l'autre lanceur |
| Vouloir des tests de mutation | livré sous les deux : `npm run test:mutation` et le *job* de la nuit, chaque contexte tenu au plancher `mutation` de la config. Vitest fait tourner les *specs* unitaires de `vitest.mutation.config.ts` ; Jest celles de `jest.mutation.config.js`, en modules ES sous le drapeau du script `test` |
| Vouloir des *specs* tenues à un budget de temps | les deux : le reporter du kit, `@ddd-ts-kit/testing/budget/vitest` ou `/budget/jest`, nommé dans la config du runner qu'écrit `init` ; cinq secondes par fichier de *spec* unitaire et trente par fichier de *spec* d'intégration par la référence |
| Vouloir des tests par propriétés | `fast-check`, ajouté avec la première propriété (`npm i -D fast-check`), sous l'un comme l'autre lanceur : une loi d'un objet-valeur énoncée une fois et vérifiée sur des valeurs générées, `fc.assert` une assertion pour `test/assertion-present` |

## Sources

- Ce dépôt : `packages/testing/README.md` (suites de contrat, « Standard decorators under
  Vitest »), `packages/cli/README.md` (`init`, « Development »), `pipeline/README.md` (seuils de
  couverture, rapports, tests de mutation), `docs/ARCHITECTURE.md` sections 5 et 7 ; les
  *templates* `packages/cli/templates/init/jest.config.js.tpl` et
  `packages/cli/templates/init/e2e/jest.e2e.config.js.tpl`.
- Vitest : https://vitest.dev/guide/features et https://vitest.dev/config/coverage (v5.0.3, lus
  le 2026-10-10) ; npm : https://www.npmjs.com/package/vitest
- Jest 30.5 : https://jestjs.io/docs/configuration , https://jestjs.io/docs/ecmascript-modules
  et https://jestjs.io/docs/cli (lus le 2026-10-10) ; npm : https://www.npmjs.com/package/jest
- Node.js, module `vm` (stabilité des modules VM) : https://nodejs.org/api/vm.html
- `@swc/jest` : https://www.npmjs.com/package/@swc/jest
- Proposition TC39 sur les décorateurs : https://github.com/tc39/proposal-decorators
- Martin Fowler, « Mocks Aren't Stubs », martinfowler.com.
- Steve Freeman et Nat Pryce, Growing Object-Oriented Software, Guided by Tests,
  Addison-Wesley, 2009.

## Voir aussi

- [Stratégie de test](../concepts/testing-strategy.fr.md)
- [L'analyse statique et le *pipeline*](static-analysis-and-pipeline.fr.md)
- [Ports et composition](../concepts/ports-and-composition.fr.md) : modes des décorateurs
- [Injection de dépendances](dependency-injection.fr.md)
- [Configuration](../CONFIG.fr.md) : `stack.tests`
