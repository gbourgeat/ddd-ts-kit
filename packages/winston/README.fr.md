[English](README.md) · **Français**
<!-- translation-of: README.md sha256:37676b9e126706c6 -->

# @ddd-ts-kit/winston

Le port `Logger` du noyau sur [winston](https://github.com/winstonjs/winston) : des lignes JSON
sur la sortie standard, les champs de corrélation du travail en cours sur chaque ligne, les
secrets d'authentification masqués, un vidage (*flush*) pour l'arrêt. Rien dans `domain/` ni dans
`application/` n'importe ce *package*, ni ne journalise quoi que ce soit : la racine de
composition lie l'adaptateur, et l'infrastructure, la présentation et les aspects écrivent par le
port.

```
npm i @ddd-ts-kit/winston winston
```

Écrit pour winston 3.19.

Le domaine et les gestionnaires (handlers) ne journalisent rien : ce qu'ils ont à dire est un
événement ou une erreur. Les adaptateurs de `infrastructure/`, les contrôleurs de
`presentation/` et les aspects (`logged`, `loggingMiddleware`, le planificateur de *jobs*)
reçoivent le `Logger` du noyau, et la racine de composition y lie `WinstonLogger` une fois. Le
code qui journalise est le même avec `@ddd-ts-kit/pino` ou `StdoutLogger` : voir
[Journaliser depuis un adaptateur](../pino/README.fr.md#journaliser-depuis-un-adaptateur).

## Racine de composition

<!-- checked sample -->
```ts
// platform/observability/create-logger.ts
import type { ExecutionScope, LogLevel } from '@ddd-ts-kit/kernel';
import { traceLogFields } from '@ddd-ts-kit/tracing';
import { createWinstonLogger, type WinstonLogger } from '@ddd-ts-kit/winston';

export interface LogSettings {
  readonly level: LogLevel; // LOG_LEVEL
  readonly format: 'json' | 'pretty'; // LOG_FORMAT
  readonly service: string;
  readonly environment: string;
  readonly scrubMessages: boolean; // LOG_SCRUB_MESSAGES
}

export function createLogger(scope: ExecutionScope, settings: LogSettings): WinstonLogger {
  return createWinstonLogger({ ...settings, fields: () => traceLogFields(scope) });
}
```

```ts
// main.ts
import { tracing } from '@/platform/observability/tracing'; // en premier
import { createLogger } from '@/platform/observability/create-logger';
import { AsyncLocalStorageExecutionScope } from '@ddd-ts-kit/kernel';
import { createApplication, kernelModule } from '@ddd-ts-kit/di';

const scope = new AsyncLocalStorageExecutionScope();
const logger = createLogger(scope, config.log);

const app = createApplication({
  modules: [kernelModule({ executionScope: scope, logger }), ...contexts],
});

process.once('SIGTERM', () => void shutdown());

async function shutdown(): Promise<void> {
  await app.stop(); // vide le rapporteur d'erreurs, puis le logger, en dernier : cela clôt le logger winston
  await tracing.shutdown();
}
```

`init --logger winston` écrit ce `create-logger.ts` (il renvoie un `NoopLogger` quand il ne
reçoit aucun réglage : c'est ainsi que les outils et les tests restent silencieux) ;
`platform/composition/lay-foundations.ts` l'appelle une fois et `composeApplication` passe le *logger* à
`kernelModule({ logger })`.

Une ligne de l'application, telle qu'elle est écrite :

```json
{"actorId":"user-1","context":"shipping","correlationId":"9f2c","environment":"production","level":"info","message":"order shipped","origin":"http","service":"shop-api","span_id":"00f067aa0ba902b7","tenantId":"acme","time":"2026-03-01T10:00:00.000Z","trace_id":"4bf92f3577b34da6a3ce929d0e0e4736"}
```

![Le chemin d'un appel à logger.info à travers winston : sous le seuil, l'adaptateur s'arrête après une comparaison ; sinon il décrit les erreurs parmi les champs et en tient à l'écart level et message ; winston fusionne les champs de la ligne, les champs des enfants et son defaultMeta ; puis les formats s'exécutent dans l'ordre : correlationFields remplit depuis fields() les clés que personne n'a données, redactCredentials masque les clés de secret, isoTime écrit time, json ou la ligne lisible sérialise ; chaque transport écrit la ligne : la console par défaut, ou les fichiers, syslog ou le flux que vous donnez](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/winston-path-of-a-line.fr.svg)

**Corrélation.** `fields` est lu à chaque ligne écrite, par un format winston : aucun point
d'appel ne passe d'identifiant. `traceLogFields(scope)` renvoie les identifiants de trace et de
*span* à l'intérieur d'un *span*, et, à l'intérieur de la portée d'exécution, l'identifiant de
corrélation, l'identifiant de causalité, l'origine, l'acteur et le *tenant*. Ce *package* ne
dépend pas du *package* de traçage : toute fonction `() => LogFields` convient,
`() => logFieldsOf(scope.current())` comprise. Une fonction qui lève une exception ne donne aucun
champ, jamais une ligne perdue. Les champs de la ligne l'emportent sur ceux d'un enfant, qui
l'emportent sur `fields` : le format ne remplit que les clés que personne n'a données.
`StdoutLogger` et `@ddd-ts-kit/pino` diffèrent sur la deuxième marche (là, `fields` l'emporte sur
un enfant) : ne liez donc pas dans un enfant une clé que `fields` renvoie si le *logger* peut
être remplacé.

![La valeur que prend une clé donnée deux fois, de la plus faible à la plus forte : avec pino et StdoutLogger, service, environment et base, puis les enfants, puis fields(), puis la ligne, qui l'emporte ; avec winston, fields(), puis les enfants, puis la ligne, puis service, environment et base, qui l'emportent](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/pino-which-value-wins.fr.svg)

**Une instance à vous.** Le projet qui configure déjà winston continue de le faire, et prend les
formats qu'il veut :

<!-- checked sample -->
```ts
import { CREDENTIAL_KEYS, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { traceLogFields } from '@ddd-ts-kit/tracing';
import winston from 'winston';
import { WinstonLogger, correlationFields, redactCredentials } from '@ddd-ts-kit/winston';

declare const scope: ExecutionScope; // celle que crée la racine de composition

const instance = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    correlationFields(() => traceLogFields(scope)),
    redactCredentials([...CREDENTIAL_KEYS, 'iban']), // après les formats qui ajoutent des champs
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

export const logger = new WinstonLogger(instance);
```

`createWinstonLogger` écrit l'instant sous `time`, le niveau par son nom et le message sous
`message`, comme le `StdoutLogger` du *package* des aspects et comme `@ddd-ts-kit/pino` : un
même tableau de bord lit les trois. Les clés d'une ligne sortent triées : le format JSON de
winston sérialise avec un sérialiseur stable.

**Des transports à vous**, sans configurer winston vous-même : `transports` remplace la console,
nommez-la donc aussi quand les lignes doivent encore atteindre la sortie standard.

<!-- checked sample -->
```ts
import { createWinstonLogger } from '@ddd-ts-kit/winston';
import winston from 'winston';

export const logger = createWinstonLogger({
  service: 'shop-api',
  transports: [
    new winston.transports.Console(), // la sortie standard, comme par défaut
    new winston.transports.File({ filename: 'logs/errors.log', level: 'error' }), // les erreurs seulement, gardées sur disque
  ],
});
```

Chaque transport filtre selon son propre `level` après l'exécution des formats : le fichier
ci-dessus reçoit les lignes `error`, la console chaque ligne à partir du seuil du *logger*.

## Mode développement

```ts
createWinstonLogger({ level: 'debug', format: 'pretty', fields: () => traceLogFields(scope) });
```

```
10:00:00.000 info order shipped { context: 'shipping', service: 'shop-api', correlationId: '9f2c' }
```

Le format `pretty` est fait des combinateurs de winston lui-même (`colorize`, `printf`), dans le
processus : aucun autre *package*, l'heure locale, le niveau en couleur, les champs tels que Node
affiche un objet, une pile sur plusieurs lignes. Choisissez le format par la configuration
(`LOG_FORMAT=pretty` dans `.env`, `json` partout ailleurs).

## Confidentialité

Les lignes de journal sont l'endroit où les données personnelles fuient : elles sont écrites
partout, lues par tout le monde et conservées longtemps. Trois choses sont faites dans
l'adaptateur, pour qu'aucun point d'appel n'ait à s'en souvenir.

**Les secrets d'authentification sont masqués** par un format winston, dans les champs d'une
ligne, d'un enfant et de `fields` de la même façon. La valeur de ces clés est remplacée par
`[redacted]`, au premier niveau d'une ligne et un niveau en dessous (`headers.authorization`,
`body.password`) :

`password`, `authorization`, `cookie`, `set-cookie`, `token`, `secret`, `apiKey`, `api_key`,
`access_token`, `refresh_token`, `accessToken`, `refreshToken`, `client_secret`

`redact: ['iban', 'ssn']` complète la liste. Les noms sont comparés exactement, casse comprise,
et rien n'est cherché plus profond qu'un niveau : journalisez la partie que vous visez, pas une
requête HTTP entière. Les objets que vous passez ne sont jamais modifiés : un objet imbriqué est
copié quand une clé doit être masquée.

**Une erreur passée en champ** (`logger.error('payment failed', { error })` : la `LogValue` du
port admet une `Error`) est écrite telle que la décrit `describeError` du noyau, de la même façon
depuis tous les *loggers* du port : sa classe en `type`, son `code` quand c'est une
`DomainError`, son `message`, sa propre `stack`, puis sa `cause` de la même façon, jusqu'à huit
niveaux. Chaque erreur d'une chaîne est écrite une fois. Les erreurs sont cherchées parmi les
champs de la ligne, pas à l'intérieur d'objets imbriqués. `CREDENTIAL_KEYS`, `REDACTED` et
`SCRUBBED_MESSAGE` sont eux aussi ceux du noyau.

**Les messages des erreurs inattendues peuvent être retirés.** Le message d'une erreur est le
premier endroit où apparaissent des données personnelles : un pilote cite la ligne qu'il a
refusée. Par défaut, il est gardé, parce qu'une ligne de journal qui dit `[message removed]` coûte
à chaque investigation. Avec une option, seuls survivent les messages que le projet a écrits
lui-même, ceux de ses `DomainError` ; classe, code, pile et cause restent pour les autres, et la
pile perd sa première ligne, qui répète le message :

```ts
createWinstonLogger({ scrubMessages: true }); // ou new WinstonLogger(instance, { scrubMessages: true })
```

C'est le `scrubMessages` que prend chaque *logger* du port (`StdoutLogger`, pino, winston,
`InMemoryLogger`) et celui de `@ddd-ts-kit/sentry`, avec la même règle, le même
`SCRUBBED_MESSAGE` et le même compromis : activez-le quand les journaux sortent de vos mains ou
quand aucun opérateur ne doit y lire ces données. Ce que dit le message d'une ligne de journal
lui-même reste à votre charge : écrivez `order shipped` et mettez les identifiants dans des
champs.

Le kit lui-même ne confie jamais une erreur à un *logger* : l'aspect `logged`,
`loggingMiddleware` et le planificateur de *jobs* écrivent seulement `errorType` et `errorCode`
(`identifyError` du noyau), jamais un message, quoi que dise `scrubMessages`, et l'erreur va à
l'`ErrorReporter`. La description ci-dessus vaut pour l'erreur que votre propre code choisit de
journaliser : `logger.error('payment failed', { error })`.

## Niveaux

| Port | winston (niveaux `npm`) | |
|---|---|---|
| `debug` | `debug` | en dessous, winston a aussi `silly` |
| `info` | `info` | le seuil par défaut ; `http` et `verbose` se placent entre `info` et `debug` |
| `warn` | `warn` | |
| `error` | `error` | |

Les noms sont les mêmes dans les niveaux `cli`. Une instance sur les niveaux `syslog` n'a pas de
`warn` : dites où il va, sinon la ligne est écartée, puisque winston n'écrit pas à un niveau qu'il
ne connaît pas.

<!-- checked sample -->
```ts
import { WinstonLogger } from '@ddd-ts-kit/winston';
import winston from 'winston';

const instance = winston.createLogger({
  levels: winston.config.syslog.levels, // emerg, alert, crit, error, warning, notice, info, debug
  transports: [new winston.transports.Console()],
});

export const logger = new WinstonLogger(instance, { levels: { warn: 'warning' } }); // logger.warn() écrit au niveau 'warning'
```

Une ligne sous le seuil coûte une comparaison : l'adaptateur interroge d'abord
`isLevelEnabled`, parce que winston seul exécuterait chaque format avant que ses transports
n'écartent la ligne. Le seuil d'une instance modifié en cours d'exécution
(`instance.level = 'debug'`) est suivi par l'adaptateur et par ses enfants. `isLevelEnabled(level)`
du port répond à la même question pour le niveau correspondant : interrogez-le avant de
construire des champs coûteux. Une fois le *logger* vidé, il répond `false` pour chaque niveau.

`child(fields)` est un enfant winston : les champs sont liés une fois, et winston les fusionne
sous les champs de chaque ligne. Trois choses diffèrent de ce que fait winston appelé
directement, toutes volontairement : un champ nommé `level` ou `message` ne remplace jamais le
niveau ou le message de la ligne ; le message n'est jamais lu comme une chaîne de format (`%s`) ;
et avec `createWinstonLogger`, un champ nommé `time` est écrasé par l'instant de la ligne. Une
chose relève de winston : `service`, `environment` et `base` sont son `defaultMeta`, qui
l'emporte sur un champ du même nom sur une ligne ou dans un enfant, là où les deux autres
*loggers* du kit laissent la ligne et l'enfant l'emporter.

## Vidage

`flush(): Promise<void>` clôt le *logger* winston et se résout une fois que chacun de ses
transports a écrit ce qui lui a été confié (leur événement `finish`). Il ne rejette jamais, et un
second appel renvoie la même promesse. `app.stop()` l'appelle, en dernier, après l'arrêt des
modules et le vidage du rapporteur d'erreurs : l'arrêt journalise lui aussi. Sans l'application
du *package* di, appelez-le vous-même à cet endroit.

| Une fois `flush()` résolu | `@ddd-ts-kit/winston` | `@ddd-ts-kit/pino` |
|---|---|---|
| une ligne journalisée | écartée, sans erreur | écrite, comme avant |
| `isLevelEnabled(level)` | `false` pour chaque niveau | le seuil, comme avant |
| un second `flush()` | la même promesse | un nouveau vidage |

Le port appelle un vidage une fois, à l'arrêt, et ne précise pas ce qui est journalisé ensuite.
Ici le vidage est définitif : un *logger* winston ne se rouvre pas, donc ce qui est journalisé
ensuite, par ce *logger* ou l'un de ses enfants, est écarté sans erreur, et `isLevelEnabled`
répond `false`. Tout ce qui doit être journalisé à propos de l'arrêt l'est avant le retour de
`app.stop()`. Un transport sur un flux que vous avez ouvert vous-même (une *socket*, un flux de
fichier donné au transport `Stream`) a confié ses lignes à ce flux quand `flush()` se résout :
fermer ce flux vous revient.

## Performances

winston écrit chaque ligne par un flux Node, une chaîne de formats et ses transports, le tout
dans le processus et dans l'appel : environ 7 microsecondes par ligne là où `@ddd-ts-kit/pino` en
prend 3 (Node 24, un enfant, quatre champs de corrélation, trois champs, un récepteur qui jette
tout), et davantage à chaque format ajouté. Chaque ligne coûte ici une copie de ses champs, une
fusion par niveau d'enfant, le format qui lit `fields`, le passage de masquage sur les valeurs de
premier niveau, l'instant, et `JSON.stringify` par un sérialiseur sûr. Ce n'est rien à quelques
centaines de lignes par seconde et c'est visible à des dizaines de milliers : là, baissez le
niveau ou prenez `@ddd-ts-kit/pino`.

Rien n'est mis en tampon par l'adaptateur, donc rien n'est perdu lors d'un plantage au-delà de ce
que le transport lui-même n'avait pas écrit. Les appels de journalisation ne lèvent jamais
d'exception : des champs qui ne peuvent être ni lus ni sérialisés (un accesseur qui lève une
exception) donnent la ligne sans eux, marquée `logError: "unserializable fields"`, et
`createWinstonLogger` tient ses formats à la même règle à l'intérieur du flux.

## Lequel choisir

Prenez `StdoutLogger` du *package* des aspects quand des lignes JSON sur la sortie standard vous
suffisent : aucune dépendance, la même forme de ligne. Prenez `@ddd-ts-kit/pino` quand le volume
de journaux compte ou quand le *framework* parle déjà pino (Fastify). Prenez winston quand
l'équipe utilise déjà ses transports et ses formats (fichiers avec rotation, syslog, un transport
d'éditeur) et veut les garder. Les trois implémentent un même port et sont tenus par une même
suite de contrat : en changer tient en une ligne de la racine de composition.

## NestJS

Nest a son propre `LoggerService`, utilisé par le *framework* pour ses propres messages et par
`new Logger(context)` dans les classes Nest. Le code applicatif du kit n'en a jamais besoin : les
gestionnaires et les adaptateurs reçoivent le `Logger` du noyau. Pour faire passer ce que Nest
journalise lui-même par la même instance, donnez-lui un pont de quelques lignes ; le kit n'en
livre aucun, car il lierait ce *package* à Nest :

```ts
const nest = logger.child({ context: 'nest' });
const bridge: LoggerService = {
  log: (message: unknown) => nest.info(String(message)),
  warn: (message: unknown) => nest.warn(String(message)),
  error: (message: unknown) => nest.error(String(message)),
  debug: (message: unknown) => nest.debug(String(message)),
};

const app = await NestFactory.create(AppModule, { logger: bridge });
```

`nest-winston` est l'alternative quand les classes Nest journalisent beaucoup : donnez-lui
l'instance winston que vous avez construite, et enveloppez la même instance dans
`new WinstonLogger(instance)` pour le kit.

## Dans un test

Rien de ce *package* : l'application de test lie l'`InMemoryLogger` du noyau, et ses `entries`
sont des données. Pour tenir un autre adaptateur du port au même comportement, lancez le
contrat :

<!-- checked sample -->
```ts
import { Writable } from 'node:stream';
import { beforeEach, describe, expect, it } from 'vitest';
import { LOG_LEVELS } from '@ddd-ts-kit/kernel';
import { loggerContract, type LoggedLine } from '@ddd-ts-kit/testing/contracts';
import { createWinstonLogger } from '@ddd-ts-kit/winston';
import winston from 'winston';

loggerContract({ describe, it, expect, beforeEach }, {
  name: 'WinstonLogger',
  createLogger: (setup) => { // { level, fields, scrubMessages }
    const written: string[] = [];
    const stream = new Writable({
      write: (chunk, _encoding, done) => {
        written.push(String(chunk));
        done();
      },
    });
    const logger = createWinstonLogger({ ...setup, transports: [new winston.transports.Stream({ stream })] });

    return { logger, lines: () => written.map((line) => lineOf(JSON.parse(line))) };
  },
});

/** Une ligne écrite telle que le contrat la lit : le niveau par son nom, le message, les autres champs. */
function lineOf({ level, message, time: _time, ...fields }: Record<string, unknown>): LoggedLine {
  const known = LOG_LEVELS.find((one) => one === level);

  if (known === undefined) {
    throw new Error(`Not a level of the port: ${String(level)}`);
  }

  return { level: known, message: String(message), fields };
}
```
