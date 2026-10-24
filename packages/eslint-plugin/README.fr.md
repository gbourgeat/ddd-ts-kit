[English](README.md) · **Français**
<!-- translation-of: README.md sha256:328005b51ed4322c -->

# @ddd-ts-kit/eslint-plugin

Des règles ESLint exactes à l'AST pour l'architecture de [docs/ARCHITECTURE.fr.md](../../docs/ARCHITECTURE.fr.md) :
frontières des couches et des contextes, pureté du domaine et de l'application, ordre du code
propre, mise en page et forme des fichiers, formes tactiques du DDD, ports en classes abstraites,
*jobs* planifiés, et déclarations d'un projet de style déclaré. Configuration *flat* uniquement,
ESLint 9 et 10.

Chaque règle lit `ddd-ts-kit.config.json` ([docs/CONFIG.fr.md](../../docs/CONFIG.fr.md)), trouvé en
remontant depuis le fichier analysé, et classe le fichier en contexte et en couche exactement comme
le fait `ddd-ts-kit check`. Elle y lit aussi `stack.style` : voir [Les deux styles](#les-deux-styles).

![ESLint passe un fichier au plugin ; le plugin remonte jusqu'à ddd-ts-kit.config.json, classe le fichier comme le fait ddd-ts-kit check (contexte billing, couche application, pas un fichier de test), exécute chaque règle sur son arbre syntaxique à la sévérité que la config donne à son identifiant, et signale la ligne, le problème, quoi écrire à la place et la règle](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/eslint-plugin-how-a-file-is-judged.fr.svg)

## Installation

```
npm i -D @ddd-ts-kit/eslint-plugin eslint @eslint/js typescript-eslint
```

`@stylistic/eslint-plugin` (5.x) vient avec le plugin comme dépendance : les *presets* s'en
servent pour les règles de mise en page, et rien n'est à installer pour lui.

## Utilisation

```js
import { dddTsKit } from '@ddd-ts-kit/eslint-plugin';

export default dddTsKit({ tsconfigRootDir: import.meta.dirname });
```

`dddTsKit(options)` renvoie un tableau de configuration *flat* complet :

| Couche de la config | Contenu |
|---|---|
| `ddd-ts-kit/ignores` | ce qui n'est jamais analysé : voir `ignores` plus bas |
| `@eslint/js` recommended | la base d'ESLint |
| typescript-eslint `strictTypeChecked` et `stylisticTypeChecked` | avec `projectService` (`ddd-ts-kit/type-information`), et sans vérification de types sur les fichiers JavaScript (`ddd-ts-kit/javascript`) ; `strict` et `stylistic` quand `typeChecked` vaut `false` |
| `ddd-ts-kit/clean-code` | les règles standard qui appuient la section 6 de la référence de l'architecture (plus bas) |
| `ddd-ts-kit/architecture` | chaque règle de ce plugin, à la sévérité de `rules.<id>` dans `ddd-ts-kit.config.json`, sinon à sa sévérité par défaut, les deux règles de mise en page de `@stylistic/eslint-plugin` à la sévérité de `rules."clean/blank-lines"` et `curly` à la sévérité de `rules."clean/braces"` (par défaut `error`) |
| `ddd-ts-kit/scripts` | `curly` sur les fichiers `.js`, `.mjs` et `.cjs`, à la sévérité de `rules."clean/braces"` : une branche se lit de la même façon dans un script |
| `ddd-ts-kit/inner-layers` | `no-param-reassign` avec `props` dans `domain/` et `application/` : pas d'argument de sortie |
| `ddd-ts-kit/aggregates` | `prefer-readonly` désactivée dans les agrégats et les entités, dont l'état est remplacé par des méthodes d'intention |
| `ddd-ts-kit/tests` | un ensemble plus léger sur `*.spec.ts`, `*.test.ts`, le répertoire `test/` de chaque contexte et le `test/` racine : `any` et `!` en avertissement, les règles `no-unsafe-*` désactivées, assertions de type permises |

| Option | Par défaut | Signification |
|---|---|---|
| `tsconfigRootDir` | le répertoire de travail | répertoire du tsconfig et de `ddd-ts-kit.config.json` |
| `typeChecked` | `true` | ajoute les règles qui lisent les types ; `false` est plus rapide et n'a besoin d'aucun tsconfig |
| `allowDefaultProject` | `['*.config.ts', '*.config.mts']` | fichiers hors du tsconfig tout de même analysés avec les types |
| `ignores` | aucun | ajoutés à `dist`, `coverage`, `node_modules`, `reports`, `*.d.ts`, et `clients/*/src` quand `ddd-ts-kit.config.json` a `"sdk"` (les clients que génère la CLI) |

Les blocs s'appliquent dans cet ordre, et un bloc ultérieur l'emporte pour les fichiers qu'il
couvre. Un bloc à vous se place après l'utilitaire :

```js
import { dddTsKit } from '@ddd-ts-kit/eslint-plugin';

export default [
  ...dddTsKit({ tsconfigRootDir: import.meta.dirname, ignores: ['src/generated/**'] }),
  // une règle que le kit n'active pas : purity/no-environment ne refuse console que dans domain/ et application/
  { files: ['src/**/*.ts'], rules: { 'no-console': 'error' } },
];
```

Pour composer une config à la main, le plugin est l'export par défaut, avec deux *presets* qui ne
contiennent que ses propres règles, les trois règles typescript-eslint auxquelles elles délèguent,
les deux règles de mise en page de `@stylistic/eslint-plugin` et `curly`, sans information de
type :

```js
import dddTsKit from '@ddd-ts-kit/eslint-plugin';

export default [...dddTsKit.configs.recommended]; // ou configs.strict : chaque règle à error
```

Les ensembles de règles standard de l'utilitaire sont exportés sous `standardRules` (`escapeHatch`,
`cleanCode`, `typedCleanCode`, `kitConventions`, `layout`, `braces`). `standardRules.braces`
contient `curly` pour [`clean/braces`](docs/rules/clean-braces.fr.md) ; `standardRules.layout`
contient les deux règles `@stylistic/*` de [`clean/blank-lines`](docs/rules/clean-blank-lines.fr.md)
à `error` ; une config composée à la main enregistre le plugin sous `@stylistic` à côté d'elles :

```js
import stylistic from '@stylistic/eslint-plugin';
import dddTsKit, { standardRules } from '@ddd-ts-kit/eslint-plugin';

export default [{ files: ['**/*.ts'], plugins: { 'ddd-ts-kit': dddTsKit, '@stylistic': stylistic }, rules: standardRules.layout }];
```

### Changer une sévérité

La sévérité d'une règle du kit s'écrit une seule fois, dans `ddd-ts-kit.config.json`, où les deux
outils la lisent :

```json
{
  "rules": {
    "clean/function-size": "error",
    "test/no-mocks": "off"
  }
}
```

```js
// au lieu de : une sévérité dans eslint.config.mjs, que `ddd-ts-kit check` ne voit jamais
export default [...dddTsKit(), { rules: { 'ddd-ts-kit/test-no-mocks': 'off' } }];
```

`"off"` dans la config fait taire la règle même là où une config ESLint l'active. Relever une
sévérité est libre ; en abaisser une sous sa valeur par défaut (`off`, ou `warn` pour une règle à
`error`) est une dérogation, et `ddd-ts-kit check` demande son enregistrement de décision : voir
[Dérogations](../../docs/CONFIG.fr.md#dérogations).

Une sévérité pour certains fichiers seulement s'écrit de la même façon, avec les fichiers qu'elle
vise : `"clean/stepdown": { "severity": "off", "files": ["src/contexts/ledger/infrastructure/legacy/**"] }`.
Le préréglage lui donne un bloc à elle après `ddd-ts-kit/architecture`, nommé
`ddd-ts-kit/rules/<id>`, dont les `files` sont ces motifs : tous les autres fichiers gardent la
sévérité du projet, dans ESLint comme dans `ddd-ts-kit check`.

## Un rapport, et quoi écrire à la place

Chaque message dit ce qui ne va pas, quoi écrire à la place, et la règle. Un gestionnaire
(handler) qui lit l'horloge système, dans
`src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts` :

```ts
// au lieu de
import type { IdGenerator } from '@ddd-ts-kit/kernel';
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';
import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';
import type { IssueInvoice } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';

export class IssueInvoiceHandler {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: IssueInvoice): Promise<string> {
    const id = this.ids.next();

    await this.invoices.save(Invoice.issue(id, command.customerId, new Date()));

    return id;
  }
}
```

est signalé, par `npx eslint src` :

```
src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
  16:68  error  new Date() without argument is used in the application layer. Receive the instant as a parameter in the domain, and take it from the Clock port (`this.clock.now()`) in a handler, so that a test fixes time with FixedClock  ddd-ts-kit/purity-no-system-clock
```

La correction que nomme le message : le port `Clock`, qu'une *spec* fige avec `FixedClock`.

<!-- checked sample -->
```ts
import { AuthorizedCommand, Clock, IdGenerator, type Actor } from '@ddd-ts-kit/kernel';

// la commande, l'agrégat et son port de repository, dans leurs propres fichiers
declare class IssueInvoice extends AuthorizedCommand<string> {
  readonly customerId: string;
  constructor(actor: Actor, customerId: string);
}
declare class Invoice {
  static issue(id: string, customerId: string, issuedAt: Date): Invoice;
}
declare abstract class InvoiceRepository {
  abstract save(invoice: Invoice): Promise<void>;
}

// écrivez : l'instant vient d'un port
export class IssueInvoiceHandler {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: IssueInvoice): Promise<string> {
    const id = this.ids.next();

    await this.invoices.save(Invoice.issue(id, command.customerId, this.clock.now()));

    return id;
  }
}
```

Quand le code a raison et que la règle a tort, la dérogation est enregistrée, pas cachée : voir le
commentaire de désactivation dans [Réglages](#réglages).

## Règles

Les identifiants sont ceux de [docs/ARCHITECTURE.fr.md](../../docs/ARCHITECTURE.fr.md) ; le nom
ESLint remplace la barre oblique par un tiret (une exception : `clean-function-ceiling`, la partie
de `clean/function-size` qui est une erreur quelle que soit la limite configurée). `strict` met
chaque règle à `error`.

| Identifiant | Nom ESLint | Tient | Par défaut | Implémentation |
|---|---|---|---|---|
| [`layer/domain-purity`](docs/rules/layer-domain-purity.fr.md) | `ddd-ts-kit/layer-domain-purity` | `domain/` n'importe que son propre domaine, le noyau partagé et les *packages* autorisés ; jamais `@ddd-ts-kit/aspects`, `audit`, `redis`, `scheduling`, `sentry` ou `tracing`, même autorisés, ni `@ddd-ts-kit/kernel/declarations` dans le style déclaré | `error` | maison |
| [`layer/application-inward`](docs/rules/layer-application-inward.fr.md) | `ddd-ts-kit/layer-application-inward` | `application/` n'importe jamais `infrastructure/`, `presentation/`, un framework, un pilote (driver) ou un *package* qui applique une préoccupation depuis l'extérieur (`@ddd-ts-kit/aspects`, `audit`, `redis`, `scheduling`, `sentry`, `tracing`) ; `@ddd-ts-kit/kernel/declarations` est toujours permis dans le style déclaré | `error` | maison |
| [`layer/presentation-no-infrastructure`](docs/rules/layer-presentation-no-infrastructure.fr.md) | `ddd-ts-kit/layer-presentation-no-infrastructure` | `presentation/` n'importe jamais `infrastructure/` | `error` | maison |
| [`layer/infrastructure-no-presentation`](docs/rules/layer-infrastructure-no-presentation.fr.md) | `ddd-ts-kit/layer-infrastructure-no-presentation` | `infrastructure/` n'importe jamais `presentation/` | `error` | maison |
| [`context/published-language-only`](docs/rules/context-published-language-only.fr.md) | `ddd-ts-kit/context-published-language-only` | un autre contexte n'est importé qu'à travers son `published-language/` | `error` | maison |
| [`context/declared-relationship`](docs/rules/context-declared-relationship.fr.md) | `ddd-ts-kit/context-declared-relationship` | un tel import exige que l'amont soit déclaré dans la config | `error` | maison |
| [`context/published-language-is-a-contract`](docs/rules/context-published-language-is-a-contract.fr.md) | `ddd-ts-kit/context-published-language-is-a-contract` | `published-language/` n'importe que sa liste d'autorisation et d'autres langages publiés | `error` | maison |
| [`language/declared-vocabulary`](docs/rules/language-declared-vocabulary.fr.md) | `ddd-ts-kit/language-declared-vocabulary` | une valeur d'un vocabulaire fermé que déclare le projet (un objet `as const` avec le type union de son nom, un ensemble de permissions) est lue à travers lui, jamais réécrite sous forme de chaîne, sous `"stack.literals": "named"` ; tests, langages publiés et, hors de `domain/`, un mot typé par un autre langage exclus | `error` | maison |
| [`naming/business-name`](docs/rules/naming-business-name.fr.md) | `ddd-ts-kit/naming-business-name` | une variable, un paramètre, une propriété, un nom déstructuré ou une variable de boucle de `domain/`, `application/` et du noyau partagé porte le nom de son concept, jamais `target`, `data`, `item` ni un autre mot générique (`words`, `allow`, `businessNames` de la configuration) ; corrigible quand l'initialiseur nomme le concept | `error` | maison |
| [`purity/no-system-clock`](docs/rules/purity-no-system-clock.fr.md) | `ddd-ts-kit/purity-no-system-clock` | pas de `new Date()`, `Date.now()`, `Date()`, `performance.now()` dans `domain/` et `application/` | `error` | maison |
| [`purity/no-ambient-randomness`](docs/rules/purity-no-ambient-randomness.fr.md) | `ddd-ts-kit/purity-no-ambient-randomness` | pas de `Math.random`, `crypto.randomUUID` ni de bibliothèque d'identifiants dans `domain/` et `application/` | `error` | maison |
| [`purity/no-environment`](docs/rules/purity-no-environment.fr.md) | `ddd-ts-kit/purity-no-environment` | pas de `process.env`, `console`, `fetch`, ni de module de système de fichiers ou de réseau dans `domain/` et `application/` | `error` | maison |
| [`clean/stepdown`](docs/rules/clean-stepdown.fr.md) | `ddd-ts-kit/clean-stepdown` | les fabriques statiques, les membres publics, puis les privés ; une fonction au-dessus des fonctions qu'elle appelle | `error` | maison |
| [`clean/function-size`](docs/rules/clean-function-size.fr.md) | `ddd-ts-kit/clean-function-size` | au plus 3 paramètres (constructeurs exemptés) et 30 lignes de code (configurable, jamais au-delà de 100) | `warn` | maison |
| [`clean/function-size`](docs/rules/clean-function-ceiling.fr.md) (plafond) | `ddd-ts-kit/clean-function-ceiling` | aucune fonction de plus de 100 lignes de code, callbacks de `describe` et fichiers de module compris | `error` | maison |
| [`clean/no-flag-argument`](docs/rules/clean-no-flag-argument.fr.md) | `ddd-ts-kit/clean-no-flag-argument` | pas de paramètre booléen sur une méthode publique du domaine ni sur `execute` | `warn` | maison |
| [`clean/no-commented-out-code`](docs/rules/clean-no-commented-out-code.fr.md) | `ddd-ts-kit/clean-no-commented-out-code` | aucun commentaire qui s'analyse comme du code | `error` | maison |
| [`clean/no-noise-comment`](docs/rules/clean-no-noise-comment.fr.md) | `ddd-ts-kit/clean-no-noise-comment` | pas de bannière, de journal des modifications, d'étiquette d'accolade fermante, de balise vide, de TODO sans responsable, ni de commentaire qui répète un nom | `warn` | maison |
| [`clean/no-escape-hatch`](docs/rules/clean-no-escape-hatch.fr.md) | `ddd-ts-kit/clean-no-escape-hatch` | pas d'assertion de type hors des *mappers*, de l'infrastructure et des `adapterGlobs` déclarés, pas d'`eslint-disable` sans raison | `error` | maison, plus 3 règles standard (plus bas) |
| [`clean/no-hash-private`](docs/rules/clean-no-hash-private.fr.md) | `ddd-ts-kit/clean-no-hash-private` | un membre de classe est `private`, jamais `#name` ; corrigeable automatiquement | `error` | maison |
| [`clean/one-export-per-file`](docs/rules/clean-one-export-per-file.fr.md) | `ddd-ts-kit/clean-one-export-per-file` | une classe, une interface ou une fonction exportée par fichier source, avec les types de sa signature, le fichier nommé d'après elle ; les fichiers d'entrée ne font que réexporter | `error` | maison |
| [`clean/file-size`](docs/rules/clean-file-size.fr.md) | `ddd-ts-kit/clean-file-size` | aucun fichier de plus de 350 lignes, tests compris | `error` | maison |
| [`clean/no-magic-number`](docs/rules/clean-no-magic-number.fr.md) | `ddd-ts-kit/clean-no-magic-number` | aucun littéral numérique dans `domain/` et `application/` hormis 0, 1, -1, un index, un type et l'initialiseur d'une constante de module ou d'un `static readonly`, sous `"stack.literals": "named"` | `error` | maison |
| [`clean/blank-lines`](docs/rules/clean-blank-lines.fr.md) | deux règles `@stylistic/*` (`standardRules.layout`) | une ligne vide avant chaque `return` et entre les blocs logiques, autour d'une méthode ; corrigeable automatiquement | `error` | standard |
| [`clean/braces`](docs/rules/clean-braces.fr.md) | `curly` (`standardRules.braces`) | chaque `if`, `else`, `for`, `while` et `do` a des accolades ; corrigeable automatiquement | `error` | standard |
| [`clean/formatted`](docs/rules/clean-formatted.fr.md) | aucun : Biome (`npm run format:check`) | chaque fichier est mis en forme par le formateur, à une largeur de ligne de 120 | aucune | formateur |
| [`domain/aggregate-encapsulation`](docs/rules/domain-aggregate-encapsulation.fr.md) | `ddd-ts-kit/domain-aggregate-encapsulation` | agrégats et entités : pas de constructeur public, pas de propriété publique modifiable, pas de *setter* | `error` | maison |
| [`domain/value-object-immutability`](docs/rules/domain-value-object-immutability.fr.md) | `ddd-ts-kit/domain-value-object-immutability` | objets-valeurs : chaque propriété `readonly`, pas de *setter*, pas d'écriture dans `this` | `error` | maison |
| [`domain/value-object-class`](docs/rules/domain-value-object-class.fr.md) | `ddd-ts-kit/domain-value-object-class` | sous `"stack.values": "classes"` : un fichier d'objet-valeur exporte une classe qui étend `ValueObject`, au constructeur privé ou protégé, avec des fabriques statiques, sans fonction ni objet littéral ; aucune fonction exportée de `domain/` ou du noyau partagé ne répond un enregistrement de données | `error` | maison |
| [`domain/no-generic-error`](docs/rules/domain-no-generic-error.fr.md) | `ddd-ts-kit/domain-no-generic-error` | pas de `throw new Error(...)` dans `domain/` et `application/` | `error` | maison |
| [`errors/through-factory`](docs/rules/errors-through-factory.fr.md) | `ddd-ts-kit/errors-through-factory` | sous `"stack.refusals": "named"` ou `"factories"`, pas de `new` d'une classe importée de `domain/errors/`, ni sous `named` d'une classe qui étend `DomainRefusal` : un refus se construit par une fabrique statique de sa classe | `error` | maison |
| [`errors/constructor-not-public`](docs/rules/errors-constructor-not-public.fr.md) | `ddd-ts-kit/errors-constructor-not-public` | sous `"stack.refusals": "named"` ou `"factories"`, une classe d'erreur de `domain/errors/` n'a pas de constructeur public, déclaré ou hérité de `DomainError` | `error` | maison |
| [`errors/factory-name`](docs/rules/errors-factory-name.fr.md) | `ddd-ts-kit/errors-factory-name` | sous `"stack.refusals": "named"`, une classe de refus ne s'appelle pas `...Error` et une fabrique commence par `for`, `with`, `because`, `on` ou `at` puis une majuscule, sans chiffre ; sous `"factories"`, une fabrique ne s'appelle pas `create`, `make`, `of` ou `error1`, et son code est son nom en casse constante, seul ou avec le nom du concept | `error` | maison |
| [`application/handler-shape`](docs/rules/application-handler-shape.fr.md) | `ddd-ts-kit/application-handler-shape` | un `*.handler.ts` exporte une classe dont la seule méthode publique est `execute` | `error` | maison |
| [`presentation/controller-shape`](docs/rules/presentation-controller-shape.fr.md) | `ddd-ts-kit/presentation-controller-shape` | un `*.controller.ts` portant `@Controller` exporte une classe dont la seule méthode publique est `handle` | `error` | maison |
| [`presentation/controller-delegates`](docs/rules/presentation-controller-delegates.fr.md) | `ddd-ts-kit/presentation-controller-delegates` | un contrôleur reçoit le bus de sa méthode, un *mapper* de requête HTTP et un sérialiseur, rien d'autre | `error` | maison |
| [`presentation/guard-at-the-edge`](docs/rules/presentation-guard-at-the-edge.fr.md) | `ddd-ts-kit/presentation-guard-at-the-edge` | un `*.guard.ts` n'importe rien de `domain/` ni de `infrastructure/`, aucun *repository*, aucune unité de travail, aucun bus de commandes | `error` | maison |
| [`presentation/shared-cache-varies`](docs/rules/presentation-shared-cache-varies.fr.md) | `ddd-ts-kit/presentation-shared-cache-varies` | une politique de cache `public` d'une route, d'un contrôleur ou d'un groupe de routes qui connaît son appelant nomme dans `vary` ce dont sa réponse dépend | `error` | maison |
| [`application/command-query-separation`](docs/rules/application-command-query-separation.fr.md) | `ddd-ts-kit/application-command-query-separation` | rien sous `application/queries` n'appelle `save`, `delete`, `publish` sur une dépendance | `warn` | maison |
| [`domain-events/dispatched-on-save`](docs/rules/domain-events-dispatched-on-save.fr.md) | `ddd-ts-kit/domain-events-dispatched-on-save` | pas de `pullEvents()` dans `application/` et `infrastructure/` ; aucun `DomainEventDispatcher` importé, listé comme dépendance ou reçu par un constructeur dans `application/commands`, `application/queries` et un adaptateur de *repository* | `error` | maison |
| [`domain-events/transactional-before-commit`](docs/rules/domain-events-transactional-before-commit.fr.md) | `ddd-ts-kit/domain-events-transactional-before-commit` | une classe portant `@DomainEventHandler` sans `phase: 'after-commit'` ne dépend d'aucun `Cache`, `Lock`, `RateLimiter`, `JobScheduler` ou `EventBus` du kernel ni de rien d'importé de `infrastructure/`, d'un autre contexte, de la plateforme ou d'un *package* autre que `@ddd-ts-kit/kernel` et `@ddd-ts-kit/auth` ; un gestionnaire after-commit ne dépend pas d'`IntegrationEventPublisher`. Les adaptateurs d'un port de `application/ports/` et la phase d'un gestionnaire du style explicite sont tenus par le *checker* de la CLI | `error` | maison |
| [`event-sourcing/state-in-apply`](docs/rules/event-sourcing-state-in-apply.fr.md) | `ddd-ts-kit/event-sourcing-state-in-apply` | un agrégat en *event sourcing* ne change son état que dans ses méthodes d'application (`apply<Fact>`, `restore`), et une méthode d'application n'enregistre aucun événement | `error` | maison |
| [`event-sourcing/past-tense`](docs/rules/event-sourcing-past-tense.fr.md) | `ddd-ts-kit/event-sourcing-past-tense` | les événements qu'un agrégat en *event sourcing* importe de `domain/events/` sont nommés au passé | `error` | maison |
| [`event-sourcing/store-behind-repository`](docs/rules/event-sourcing-store-behind-repository.fr.md) | `ddd-ts-kit/event-sourcing-store-behind-repository` | pas d'`EventStore`, `SnapshotStore`, `CheckpointStore`, `EventSourcedRepository`, `EventSerializer`, `CatchUpSubscription` dans `domain/` et `application/` : l'agrégat passe par son *repository* | `error` | maison |
| [`event-sourcing/projection-never-appends`](docs/rules/event-sourcing-projection-never-appends.fr.md) | `ddd-ts-kit/event-sourcing-projection-never-appends` | une projection ne nomme aucun *event store*, et une projection alimentée par le store aucun *repository* : elle n'ajoute jamais rien à un flux | `error` | maison |
| [`event-sourcing/upcaster-required`](docs/rules/event-sourcing-upcaster-required.fr.md) | `ddd-ts-kit/event-sourcing-upcaster-required` | `defineStoredEvent` nomme le type de ses données, déclaré dans le fichier, et une version au-dessus de 1 a un *upcaster* depuis chaque version inférieure (le verrou des formes enregistrées : `ddd-ts-kit check`) | `error` | maison |
| [`test/no-mocks`](docs/rules/test-no-mocks.fr.md) | `ddd-ts-kit/test-no-mocks` | pas de `vi.mock`, `vi.fn`, `vi.spyOn`, de leurs jumeaux `jest` ni de bibliothèque de *mocks* dans les tests d'un contexte | `warn` | maison |
| [`test/no-only-no-skip`](docs/rules/test-no-only-no-skip.fr.md) | `ddd-ts-kit/test-no-only-no-skip` | pas de `.only` ni `.skip` sur un test ou un groupe, pas de `fit`, `xit`, `xdescribe`, pas de `.skipIf` ni `.runIf` sur une constante : chaque test s'exécute, ou s'exécute partout où sa condition tient | `error` | maison |
| [`test/title-states-a-rule`](docs/rules/test-title-states-a-rule.fr.md) | `ddd-ts-kit/test-title-states-a-rule` | le titre d'un test énonce la règle qu'il prouve, en minuscules, après les *rows* et le critère qu'il cite ; jamais `should`, `test`, `works`, ni une méthode ou une classe ; un `describe` nomme l'unité | `error` | maison |
| [`test/no-logic`](docs/rules/test-no-logic.fr.md) | `ddd-ts-kit/test-no-logic` | ni `if`, ni `switch`, ni ternaire, ni boucle, ni `try` dans un test : un cas par ligne est un `it.each`, une décision appartient à un *builder*, un *fake* ou un *helper* | `error` | maison |
| [`test/assertion-present`](docs/rules/test-assertion-present.fr.md) | `ddd-ts-kit/test-assertion-present` | chaque test vérifie quelque chose : un `expect`, un *helper* `expect...` ou `assert...`, ou le résultat d'un scénario (`thenEvents`, `thenError`) ; un test sans corps est un `it.todo` | `error` | maison |
| [`test/refusal-by-code`](docs/rules/test-refusal-by-code.fr.md) | `ddd-ts-kit/test-refusal-by-code` | un refus se vérifie par son code et ses faits, jamais par `toThrow` avec un message, une classe ou rien | `error` | maison |
| [`test/no-snapshot`](docs/rules/test-no-snapshot.fr.md) | `ddd-ts-kit/test-no-snapshot` | aucun *matcher* de *snapshot* dans un test : un test vérifie les champs dont la règle dépend | `error` | maison |
| [`events/name-format`](docs/rules/events-name-format.fr.md) | `ddd-ts-kit/events-name-format` | les noms d'événements suivent `<context>.<aggregate>.<fact>` en kebab-case | `error` | maison |
| [`events/outbox-required`](docs/rules/events-outbox-required.fr.md) | `ddd-ts-kit/events-outbox-required` | aucun client de *broker* et aucun bus concret dans `domain/` et `application/` ; un *publisher* dépend du port `IntegrationEventPublisher` | `error` | maison |
| [`events/consumer-idempotent`](docs/rules/events-consumer-idempotent.fr.md) | `ddd-ts-kit/events-consumer-idempotent` | un consommateur se déclare avec un nom `consumer` et un store d'événements traités, jamais par un simple `subscribe` ; dans le style déclaré, `@IntegrationEventHandler` écrit son `consumer` comme une chaîne littérale | `error` | maison |
| [`context/extractable`](docs/rules/context-extractable.fr.md) | `ddd-ts-kit/context-extractable` | aucun schéma ni aucune table d'un autre contexte, aucun état modifiable exporté, rien d'un autre contexte câblé dans le module et, dans le style déclaré, aucun port d'un autre contexte importé par un fichier de rôle | `error` | maison |
| [`authz/declared`](docs/rules/authz-declared.fr.md) | `ddd-ts-kit/authz-declared` | une commande ou une requête enregistrée dit `.requires(...)` ou `.public()`, ou sa classe porte `@Requires` ou `@Public` (exigé sur chaque message du style déclaré), une route déclare `security`, un message autorisé transmet son acteur | `error` | maison |
| [`authz/in-application`](docs/rules/authz-in-application.fr.md) | `ddd-ts-kit/authz-in-application` | aucun test de rôle dans `presentation/`, aucune autorisation dans `infrastructure/`, aucun acteur, aucune session, aucun contexte d'exécution ni droit dans `domain/` ; dans le style déclaré, `Requires`, `Public`, `Policy` et le port `Access` restent dans `application/` | `error` | maison |
| [`authz/actor-explicit`](docs/rules/authz-actor-explicit.fr.md) | `ddd-ts-kit/authz-actor-explicit` | pas d'`ExecutionScope`, d'`ActorContext` (type ou valeur : la classe est le jeton) ni d'`AsyncLocalStorage`, aucune lecture du contexte ambiant, pas de `stampCreation`, `stampUpdate` ou `tenantScopeOf` dans `domain/` et `application/` | `error` | maison |
| [`authz/fields-by-schema`](docs/rules/authz-fields-by-schema.fr.md) | `ddd-ts-kit/authz-fields-by-schema` | aucun test sur les rôles de l'acteur, aucune comparaison avec un rôle ni `isAdmin` sous `application/queries/` : un champ réservé à certains appelants est marqué avec `withFieldAccess` | `error` | maison |
| [`aspects/outside-in`](docs/rules/aspects-outside-in.fr.md) | `ddd-ts-kit/aspects-outside-in` | `@ddd-ts-kit/aspects/decorators` n'est importé que dans `infrastructure/` et dans la plateforme | `error` | maison |
| [`tracing/platform-only`](docs/rules/tracing-platform-only.fr.md) | `ddd-ts-kit/tracing-platform-only` | `@ddd-ts-kit/tracing` et `@opentelemetry/*` ne sont importés que par le répertoire de la plateforme, `main.ts` et `apps/` | `error` | maison |
| [`standard/no-parallel-interface`](docs/rules/standard-no-parallel-interface.fr.md) | `ddd-ts-kit/standard-no-parallel-interface` | aucun `ILogger`, `UserContext`, `PaginatedResult`, `CronJob`, `ErrorTracker` ni semblable déclaré à côté des interfaces standard du kernel (`standardInterfaces` dans la config) | `warn` | maison |
| [`governance/recorded-deviation`](docs/rules/governance-recorded-deviation.fr.md) | `ddd-ts-kit/governance-recorded-deviation` | chaque désactivation nomme ses règles et renvoie à `ADR-<number>` après `--` | `error` | maison |
| [`declarations/role-declared`](docs/rules/declarations-role-declared.fr.md) | `ddd-ts-kit/declarations-role-declared` | style déclaré seulement : un fichier de rôle exporte une classe portant le décorateur de son rôle, le `consumer` et le `name` d'une déclaration sont des chaînes littérales, `domain/` ne porte aucun décorateur de déclaration | `error` | maison |
| [`declarations/constructor-injection`](docs/rules/declarations-constructor-injection.fr.md) | `ddd-ts-kit/declarations-constructor-injection` | style déclaré seulement : une classe dont le décorateur ne liste aucune dépendance type chaque paramètre de son constructeur par une classe, sans `?`, valeur par défaut, paramètre rest ni déstructuration ; sous `stack.dependencies: signature`, un décorateur ne porte aucune liste (une liste qui répète le constructeur est retirée par la correction, une liste qui en diffère est signalée) | `error` | maison |
| [`ports/abstract-class`](docs/rules/ports-abstract-class.fr.md) | `ddd-ts-kit/ports-abstract-class` | un port (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`) est une classe abstraite aux seuls membres abstraits, jamais une interface | `error` | maison |
| [`ports/implements-never-extends`](docs/rules/ports-implements-never-extends.fr.md) | `ddd-ts-kit/ports-implements-never-extends` | un adaptateur (`@Repository`, `@Gateway`, `@Adapter`, `bind(Port).toClass(Class)`) implémente son port et ne l'étend jamais | `error` | maison |
| [`ports/no-token-constant`](docs/rules/ports-no-token-constant.fr.md) | `ddd-ts-kit/ports-no-token-constant` | une dépendance est nommée par sa classe de port : aucun utilitaire de jeton, symbole, chaîne ou constante, aucun fichier de jetons | `error` | maison |
| [`ports/no-concrete-dependency`](docs/rules/ports-no-concrete-dependency.fr.md) | `ddd-ts-kit/ports-no-concrete-dependency` | une liste de dépendances ne nomme rien d'importé de `infrastructure/` ou de `test/fakes/`, et aucun paramètre de constructeur d'une classe déclarée qui ne liste rien n'est typé par une telle classe | `error` | maison |
| [`ports/value-import`](docs/rules/ports-value-import.fr.md) | `ddd-ts-kit/ports-value-import` | un port nommé dans une liste de dépendances ou donné à `bind` n'est pas un import de type seul ; corrigeable automatiquement | `error` | maison |
| [`scheduling/job-triggers-use-case`](docs/rules/scheduling-job-triggers-use-case.fr.md) | `ddd-ts-kit/scheduling-job-triggers-use-case` | un *job* vit dans `application/scheduling/*.job.ts`, implémente `ScheduledJob`, envoie une commande, et ne touche ni un *repository* ni le modèle | `error` | maison |
| [`scheduling/job-name`](docs/rules/scheduling-job-name.fr.md) | `ddd-ts-kit/scheduling-job-name` | un *job* est nommé `<context>.<job-name>` par une chaîne littérale, et son `systemActor` porte ce nom | `error` | maison |
| [`lifecycle/status-through-machine`](docs/rules/lifecycle-status-through-machine.fr.md) | `ddd-ts-kit/lifecycle-status-through-machine` | dans un agrégat qui importe sa machine à états, le statut n'est écrit que depuis la machine (`next`, `start`) ou copié d'un statut déjà lu | `error` | maison |
| [`process/sends-commands-only`](docs/rules/process-sends-commands-only.fr.md) | `ddd-ts-kit/process-sends-commands-only` | un gestionnaire de processus de `application/processes/` n'importe aucun agrégat, entité, *repository*, service du domaine, port ni infrastructure : il change le monde par les commandes qu'il décide | `error` | maison |
| [`schema/presentation-only`](docs/rules/schema-presentation-only.fr.md) | `ddd-ts-kit/schema-presentation-only` | sous `stack.schemas: shared`, un schéma du contrat HTTP vit dans `presentation/` de son contexte ou du noyau partagé : le noyau partagé n'importe aucune bibliothèque de validation hors de `presentation/`, et aucun domaine, application, infrastructure ni langage publié n'importe un fichier de `presentation/` du noyau partagé | `error` | maison |
| [`imports/alias-only`](docs/rules/imports-alias-only.fr.md) | `ddd-ts-kit/imports-alias-only` | un fichier du projet est importé par son alias (`@/...`, `$test/...`, `$scripts/...`), jamais par un chemin relatif, même répertoire compris ; aucun segment `.` ou `..` dans le chemin d'un alias ; corrigeable automatiquement | `error` | maison |
| [`imports/extension`](docs/rules/imports-extension.fr.md) | `ddd-ts-kit/imports-extension` | un import d'un fichier du projet se termine comme le dit `importExtension` de la config : pas d'extension sous `none`, `.js` sous `js` ; corrigeable automatiquement | `error` | maison |

Les identifiants `domain/*` et `application/*` sont ajoutés par ce plugin : la forme d'une classe
exige un arbre syntaxique, si bien que le *checker* de la CLI n'a pas d'équivalent. Les
identifiants `domain-events/*` n'en font pas partie : les deux outils les tiennent, et de
`domain-events/transactional-before-commit`, le *checker* seul tient ce qu'un fichier ne montre
pas (où vivent les adaptateurs d'un port de `application/ports/`, la phase dans laquelle un
fichier de module du style explicite enregistre un gestionnaire).

### Les deux styles

`stack.style` dans `ddd-ts-kit.config.json` dit comment sont écrits les contextes du projet :
`explicit`, chaque liaison est écrite dans `<context>.module.ts` ; `declared`, chaque classe dit
ce qu'elle est avec un décorateur de `@ddd-ts-kit/kernel/declarations` et il n'y a pas de fichier
de module. Une config qui ne le dit pas est `explicit`, et un projet de style explicite est jugé
exactement comme avant l'existence du style déclaré.

| Règle | Ajouté dans un projet de style déclaré |
|---|---|
| `authz/declared` | une classe exportée d'un fichier `*.command.ts` ou `*.query.ts` porte `@Requires(...)` ou `@Public()` |
| `authz/in-application` | `Requires`, `Public` et `Policy` ne sont pas importés dans `presentation/` ni dans `infrastructure/`, ni les ports `Access` et `PolicyAccess` dans `infrastructure/` |
| `layer/application-inward` | `@ddd-ts-kit/kernel/declarations` est permis quoi que dise `applicationAllowedPackages` |
| `layer/domain-purity` | `@ddd-ts-kit/kernel/declarations` est refusé dans `domain/` |
| `events/consumer-idempotent` | `@IntegrationEventHandler` écrit son `consumer` comme une chaîne littérale non vide |
| `context/extractable` | un fichier de rôle n'importe rien d'un fichier de port d'un autre contexte |
| `declarations/role-declared` | la règle entière |

Une chose vaut dans les deux styles : une classe de message portant `@Requires` ou `@Public` est
déclarée, si bien qu'un module qui l'enregistre sans `.requires(...)` ni `.public()` n'est pas
signalé.

Un décorateur est lu dans l'arbre syntaxique et compte quand son nom est importé de
`@ddd-ts-kit/kernel/declarations` dans le fichier, y compris sous un alias
(`{ Repository as Repo }`) ou un espace de noms (`declarations.Repository`). Deux vérifications
regardent une classe d'un autre fichier (le message qu'enregistre un module, la classe donnée à
`toClass`) : l'import est résolu comme tout autre, le
fichier est lu sur le disque et analysé sans types, et rien n'est conclu quand cela échoue.
`stack.assembly` (`barrel` ou `discovery`) est lu avec le style ; aucune règle de ce plugin n'en
dépend, puisque le barrel est un fait du projet que tient `ddd-ts-kit check`
(`declarations/barrel-current`).

### Des règles standard plutôt que des règles maison

Là où une règle standard couvre entièrement une partie de la référence de l'architecture, les
*presets* l'activent et ce plugin ne la réimplémente pas.

| Référence de l'architecture | Règle standard | Activée par |
|---|---|---|
| `clean/no-escape-hatch` : `any` explicite | `@typescript-eslint/no-explicit-any` | `recommended`, `strict`, `dddTsKit()` |
| `clean/no-escape-hatch` : assertion non nulle | `@typescript-eslint/no-non-null-assertion` | `recommended`, `strict`, `dddTsKit()` |
| `clean/no-escape-hatch` : `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` sans description | `@typescript-eslint/ban-ts-comment` | `recommended`, `strict`, `dddTsKit()` |
| section 6, commande ou requête et promesses | `@typescript-eslint/no-floating-promises`, `no-misused-promises` | `dddTsKit()` avec les types |
| section 6, erreurs spécifiques, décisions exhaustives | `@typescript-eslint/switch-exhaustiveness-check`, `no-unnecessary-condition` | `dddTsKit()` avec les types |
| section 6, immutabilité | `@typescript-eslint/prefer-readonly` | `dddTsKit()` avec les types |
| section 6, types | `@typescript-eslint/consistent-type-imports` | `dddTsKit()` |
| section 6, petites fonctions | `complexity` (10, warn), `max-depth` (3, warn), `no-else-return` | `dddTsKit()` |
| section 6, pas d'argument de sortie | `no-param-reassign` (`props` dans `domain/` et `application/`) | `dddTsKit()` |
| section 6, pas de surprise | `eqeqeq` | `dddTsKit()` |
| section 6, mise en page (`clean/blank-lines`) | `@stylistic/padding-line-between-statements`, `lines-between-class-members` | `recommended`, `strict`, `dddTsKit()` |
| section 6, mise en page (`clean/braces`) | `curly` (`all`) | `recommended`, `strict`, `dddTsKit()` |

`max-params`, `max-lines-per-function` et `max-lines` ne sont volontairement pas activées :
`clean-function-size` exempte les constructeurs et les fichiers de module et lit `limits` dans la
config, `clean-file-size` exempte les fichiers générés, ce que les règles standard ne savent pas
faire, et les deux signaleraient la même chose deux fois. La mise en page est le cas inverse :
`clean/blank-lines` est entièrement tenue par `@stylistic/eslint-plugin` et `clean/braces` par
`curly`, et ce plugin n'écrit aucune règle pour elles. L'emplacement d'un *token* (indentation,
guillemets, retours à la ligne, marge intérieure d'un bloc) n'est pas du tout vérifié par le
linter : c'est le formateur du projet, Biome, qui en décide (`clean/formatted`), et aucune règle
`@stylistic` qui le contredirait n'est activée.

### Là où le kit et typescript-eslint strict divergent

`dddTsKit()` change dix règles strictes, chacune pour une raison énoncée, pour que du code
fraîchement généré ne soit pas signalé parce qu'il suit les conventions du kit :

| Règle | Réglage | Raison |
|---|---|---|
| `require-await` | désactivée | un port est asynchrone par contrat ; un adaptateur en mémoire n'a rien à attendre |
| `no-unnecessary-type-arguments` | désactivée | le type d'identifiant d'un agrégat fait partie de sa déclaration |
| `consistent-type-definitions` | désactivée | les props sont des alias de type, les états et les options des interfaces |
| `no-empty-object-type` | interfaces permises | `interface SessionExtensions {}` reste ouverte à la fusion de déclarations |
| `no-extraneous-class` | classes vides et classes décorées permises | un service du domaine ou un *fake* commence vide ; une classe qui porte un décorateur est une déclaration, quel que soit son corps |
| `no-unused-vars` | `args: 'none'` | un adaptateur implémente toute la signature de son port |
| `dot-notation` | signatures d'index permises | `process.env['PORT']` |
| `no-confusing-void-expression`, `restrict-template-expressions`, `restrict-plus-operands` | forme abrégée des fonctions fléchées, nombres et booléens permis | ce ne sont pas des bogues de coercition |

## Réglages

`settings['ddd-ts-kit']` remplace ce qui est lu sur le disque, pour les tests et les éditeurs :

| Clé | Signification |
|---|---|
| `config` | le contenu de `ddd-ts-kit.config.json`, sous forme d'objet |
| `rootDir` | la racine du projet, quand `config` est donné (par défaut : le répertoire de travail) |
| `filename` | chemin posix relatif à la racine, utilisé à la place du vrai nom de fichier |

```ts
ruleTester.run('layer-domain-purity', rule, {
  valid: [],
  invalid: [
    {
      code: "import { z } from 'zod';",
      settings: { 'ddd-ts-kit': { config: {}, filename: 'src/contexts/billing/domain/aggregates/invoice.aggregate.ts' } },
      errors: [{ messageId: 'package' }],
    },
  ],
});
```

Le fichier de config est lu une fois par répertoire et par processus : redémarrez le serveur
ESLint de l'éditeur après avoir modifié `ddd-ts-kit.config.json`.

Deux choses fonctionnent comme avec le *checker* de la CLI : `rules.<id>: "off"` dans la config
fait taire la règle même quand la config ESLint l'active, et
`// ddd-ts-kit-disable-next-line <id> -- <reason>` fait taire une ligne pour les deux outils. Une
désactivation sans raison ne fait rien taire, et `governance/recorded-deviation` demande que la
raison renvoie à un enregistrement de décision (`ADR-<number>`) :

```ts
// au lieu de : une raison qui ne renvoie à aucune décision
// ddd-ts-kit-disable-next-line clean/no-flag-argument -- gardé pour l'instant
cancel(force: boolean): void {
```

```
12:3  error  `ddd-ts-kit-disable-next-line clean/no-flag-argument` on line 12 silences a rule without pointing to a decision. Fix the diagnostic; if the deviation is deliberate, record it with `ddd-ts-kit generate adr` (reason, scope, condition for removing it) and end the comment with `-- ADR-<number>: <reason>`  ddd-ts-kit/governance-recorded-deviation
```

```ts
// écrivez : l'enregistrement de décision dit pourquoi, pour quelle portée et jusqu'à quand
// ddd-ts-kit-disable-next-line clean/no-flag-argument -- ADR-0007: l'ancien import envoie un indicateur jusqu'en 2027
cancel(force: boolean): void {
```

L'identifiant est celui de la référence de l'architecture (`clean/no-flag-argument`), pas le nom
ESLint, et `npx ddd-ts-kit generate adr` écrit l'enregistrement. Les commentaires `eslint-disable`
sont tenus de la même façon, par `clean/no-escape-hatch` et `governance/recorded-deviation`.

## Avec `ddd-ts-kit check`

Deux outils, un seul jeu d'identifiants, aucun recouvrement d'autorité. Un troisième,
dependency-cruiser, ne lit pas la config : il s'exécute sur un fichier qui en est généré, avec ses
propres noms de règle.

![Le plugin et ddd-ts-kit check lisent ddd-ts-kit.config.json à l'exécution et en partagent les identifiants de règle, les sévérités et les commentaires de désactivation : le plugin juge un fichier source à la fois sur son arbre syntaxique et a raison quand il diverge du checker ; le checker juge ce qui dépasse un fichier, l'arborescence, les noms, les glossaires, la config et le barrel ; dependency-cruiser ne s'exécute que sur le .dependency-cruiser.cjs que depcruise-config --write génère à partir de la config et juge le graphe des imports résolu avec ses propres noms de règle, toujours en sévérité error, sans tenir compte des commentaires de désactivation](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/eslint-plugin-two-tools.fr.svg)

| Préoccupation | Autorité | Pourquoi |
|---|---|---|
| imports et frontières (`layer/*`, `context/published-language-only`, `context/declared-relationship`, `context/published-language-is-a-contract`), `purity/*`, `clean/*`, `test/no-mocks`, les six règles sur la forme d'un test (`test/no-only-no-skip`, `test/title-states-a-rule`, `test/no-logic`, `test/assertion-present`, `test/refusal-by-code`, `test/no-snapshot`), `events/name-format`, `domain/*`, `application/*`, le côté code de `events/outbox-required`, `events/consumer-idempotent`, `context/extractable`, `authz/*`, `aspects/outside-in`, `tracing/platform-only`, `domain-events/dispatched-on-save`, `domain-events/transactional-before-commit` sur une classe déclarée, `event-sourcing/*` (sauf le verrou de `event-sourcing/upcaster-required`), `standard/no-parallel-interface`, `declarations/role-declared`, `ports/*`, `scheduling/*` (sauf l'unicité des noms de *jobs*), `language/declared-vocabulary`, `errors/through-factory`, `errors/constructor-not-public`, `errors/factory-name`, `presentation/*`, `lifecycle/*`, `process/*`, `schema/presentation-only`, `imports/alias-only`, `imports/extension` et `governance/recorded-deviation` | ce plugin | il lit l'arbre syntaxique : aucun faux positif dû à une chaîne ou à un commentaire, le masquage de variables et les fonctions fléchées sont compris |
| l'arborescence (`tree/closed`, `tree/context-doc`), les noms et les fichiers (`naming/*` hormis le côté code de `naming/business-name`, que ce plugin lit sur l'arbre syntaxique et corrige, `test/spec-required`, `test/builder-required`), le langage (`language/glossary-term`, `language/no-technical-name`), les codes d'erreur (`errors/code-unique`, `errors/known-code`), `imports/alias-declared`, `schema/no-duplicate-shape`, la config (`config/*`, `context/no-cycle`), `events/defined-in-published-language`, `composition/only-in-module`, `declarations/barrel-current`, l'unicité des noms de consommateurs et de *jobs*, une seule classe déclarée par fichier de rôle, de `domain-events/transactional-before-commit` les adaptateurs d'un port de `application/ports/` et la phase d'un gestionnaire du style explicite, le côté config des identifiants ci-dessus (`stack.events`, sévérités abaissées, existence d'un enregistrement de décision) | `ddd-ts-kit check` | ils jugent le projet, le glossaire et des fichiers qui ne sont pas des sources ; ESLint juge une source à la fois |
| le vrai graphe des dépendances (barrels, cycles, orphelins, dépendances de développement dans le code de production) | dependency-cruiser, configuré par le `.dependency-cruiser.cjs` que `ddd-ts-kit depcruise-config --write` génère à partir de la config | il résout les modules au lieu de classer des chemins |

La CLI continue d'approcher les règles de niveau code par des expressions régulières, sans
dépendance : c'est la garde qui s'exécute dans un *hook* de l'éditeur après chaque écriture.
Quand les deux signalent le même identifiant, corrigez le code une fois ; quand ils divergent, ce
plugin a raison et c'est le *checker* qu'il faut corriger. Un test de ce *package* fige la
classification des fichiers et des imports par rapport à la CLI sur les mêmes chemins d'exemple.

## TypeScript 7

typescript-eslint a besoin de l'API JavaScript du compilateur, que le TypeScript 7 natif ne
fournit pas (`typescript-eslint` 8.71 exige `typescript <6.1`). Gardez les deux :

```json
{
  "devDependencies": {
    "typescript": "~6.0.3",
    "@typescript/native": "npm:typescript@~7.0.2"
  },
  "scripts": {
    "typecheck": "node node_modules/@typescript/native/bin/tsc -p tsconfig.json --noEmit",
    "lint": "eslint ."
  }
}
```

`typescript` 6 sert les outils qui lisent les sources par l'API du compilateur (ESLint,
dependency-cruiser) ; le 7 natif compile et vérifie les types. Appelez le compilateur natif par
son chemin : les deux *packages* déclarent un binaire `tsc` et `npx tsc` choisit l'un d'eux.

## Développement

```
node node_modules/@typescript/native/bin/tsc -b packages/eslint-plugin
npx vitest run packages/eslint-plugin
```

Les règles sont testées avec `@typescript-eslint/rule-tester` branché sur Vitest
(`test/support/rule-tester.ts`). Une règle vient avec des cas valides et invalides, un message qui
dit quoi faire à la place, et une page dans `docs/rules/`. Le *package* est tenu par ses propres
règles à travers le `eslint.config.mjs` racine : un export par fichier, des fichiers nommés
d'après leur export, les règles de mise en page.
