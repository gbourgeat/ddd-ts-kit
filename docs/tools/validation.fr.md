[English](validation.md) · **Français**
<!-- translation-of: validation.md sha256:00fbbf728727f305 -->

# Bibliothèques de validation : zod, class-validator, TypeBox, Standard Schema

**Résumé.** Dans ce kit, la validation veut dire une seule chose : vérifier la forme de ce qui
franchit une frontière (une requête HTTP, la charge utile d'un événement d'intégration). Elle se
fait derrière un petit port `Schema` de `@ddd-ts-kit/validation`, avec des adaptateurs pour zod,
class-validator, TypeBox et toute bibliothèque qui implémente Standard Schema (valibot, arktype
et d'autres). Comme les routes, les événements et le générateur OpenAPI dépendent du port, la
bibliothèque est remplaçable ; ce qui diffère entre les quatre adaptateurs, c'est la qualité du
contrat généré, les codes d'erreur et le mode des décorateurs qu'ils imposent. Les règles
métier ne sont pas de la validation et n'utilisent jamais ces bibliothèques.

## Où se place la validation

« `startsAt` est une date-heure ISO » est de la validation : c'est vrai ou faux du seul texte.
« Le créneau est encore libre » est un invariant de `appointments` ; « seul le client qui a
réservé peut annuler » est une permission. Les trois vivent à trois endroits
([invariants, permissions et validation](../concepts/invariants-permissions-validation.fr.md)),
et `layer/domain-purity` dans [ARCHITECTURE.md](../ARCHITECTURE.fr.md) refuse une bibliothèque
de validation dans `domain/`.

![Une requête HTTP de prise de rendez-vous passe trois vérifications dans trois couches : le schéma de la route vérifie sa forme (refus avec 422 VALIDATION_FAILED), le bus vérifie la permission de l'acteur (refus avec 403 FORBIDDEN), l'objet-valeur et l'agrégat vérifient les invariants (refus avec le code du domaine, comme INVALID_TIME_SLOT)](../assets/diagrams/validation-three-checks.fr.svg)

<!-- checked sample -->
```ts
// contexts/appointments/presentation/http/book-appointment.schema.ts : la forme de la requête HTTP, rien d'autre
import { z } from 'zod';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

export const bookAppointmentBody = zodSchema(
  z.object({
    practitionerId: z.uuid(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  }),
);

// { practitionerId: string; startsAt: string; endsAt: string }
export type BookAppointmentBody = Infer<typeof bookAppointmentBody>;
```

Que `endsAt` soit après `startsAt` se décide une fois, par l'objet-valeur `TimeSlot`, quel que
soit l'appelant : une route, un gestionnaire (handler) d'événement d'intégration ou un *job*. Au
lieu d'écrire la règle dans le schéma d'une route :

```ts
// presentation/http : la règle ne tient que pour cette route, et son refus est un VALIDATION_FAILED
const bookAppointmentBody = zodSchema(
  z
    .object({ practitionerId: z.uuid(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime() })
    .refine((body) => body.endsAt > body.startsAt, { message: 'endsAt must follow startsAt' }),
);
```

écrivez-la dans le domaine, où chaque appelant la rencontre, avec un code à elle :

<!-- checked sample -->
```ts
// contexts/appointments/domain/value-objects/time-slot.vo.ts
import { ConceptError, ValueObject } from '@ddd-ts-kit/kernel';

export class TimeSlotError extends ConceptError {
  static endsBeforeItStarts(startsAt: Date, endsAt: Date) {
    return TimeSlotError.refusal('INVALID_TIME_SLOT', 'A slot ends after it starts.', { startsAt, endsAt });
  }
}

export class TimeSlot extends ValueObject<{ readonly startsAt: Date; readonly endsAt: Date }> {
  static create(startsAt: Date, endsAt: Date): TimeSlot {
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw TimeSlotError.endsBeforeItStarts(startsAt, endsAt);
    }

    return new TimeSlot({ startsAt, endsAt });
  }
}
```

## Le port

```ts
interface Schema<T> {
  parse(input: unknown): Result<T, ValidationIssue[]>; // ne lève jamais d'erreur pour une entrée invalide
  toJsonSchema(): JsonSchema;                          // alimente OpenAPI et AsyncAPI
}
```

Un schéma est une valeur remise à la route ou à l'événement qui valide avec lui. Il n'est jamais
lié dans un conteneur, c'est pourquoi c'est une interface et non un port injectable.
`parseOrThrow` lève une `ValidationError`, une `DomainError` de code `VALIDATION_FAILED`, à
laquelle le *pipeline* HTTP répond par un problème 422 avec une anomalie par chemin.

![Quatre adaptateurs (zod, class-validator, TypeBox, Standard Schema) produisent une valeur du port Schema ; sa méthode parse sert les routes et les gestionnaires d'événements d'intégration, sa méthode toJsonSchema sert les documents OpenAPI et AsyncAPI et le catalogue des événements](../assets/diagrams/validation-one-port.fr.svg)

Ce que reçoit un appelant, avec le schéma zod ci-dessus et un corps auquel manque `endsAt` et
qui porte un identifiant mal formé :

<!-- checked sample -->
```ts
import { z } from 'zod';
import { parseOrThrow, ValidationError } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

const bookAppointmentBody = zodSchema(
  z.object({ practitionerId: z.uuid(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }),
);
const input: unknown = { practitionerId: 'nope', startsAt: '2026-03-02T09:00:00Z' };

// parse ne lève jamais d'erreur pour une entrée invalide : il renvoie un Result
const result = bookAppointmentBody.parse(input);

if (!result.ok) {
  // [{ path: 'practitionerId', code: 'invalid_format', message: 'Invalid UUID' },
  //  { path: 'endsAt', code: 'invalid_type', message: 'Invalid input: expected string, received undefined' }]
  console.log(result.error);
}

// parseOrThrow renvoie la valeur, ou lève ce à quoi le pipeline HTTP répond par un problème 422
try {
  parseOrThrow(bookAppointmentBody, input);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.code, error.issues.length); // VALIDATION_FAILED 2
  }
}
```

Une route n'appelle jamais ni l'un ni l'autre elle-même : le *pipeline* de `@ddd-ts-kit/http`
analyse chaque partie avec le schéma que déclare la route, et le gestionnaire reçoit la valeur
analysée. Une propriété que le schéma ne déclare pas est écartée par zod et TypeBox, et refusée
par class-validator.

## Comparaison

Versions, licences et téléchargements vérifiés le 2026-10-10 auprès du registre npm et de
GitHub.

| | zod | class-validator | TypeBox | Standard Schema (valibot, arktype, ...) |
|---|---|---|---|---|
| Ce que c'est | constructeur de schémas, types déduits du schéma | décorateurs sur des classes DTO, avec class-transformer | constructeur de JSON Schema avec types statiques, validateurs compilés | une interface commune qu'implémentent les bibliothèques de schémas, pas une bibliothèque |
| Version actuelle | 4.6.5 | 0.15.1 (février 2026) ; class-transformer 0.5.1 date de novembre 2021 | `typebox` 1.3.36 (2026-10-06 ; `@sinclair/typebox` 0.34 est son prédécesseur) | spécification 1.1.0 ; valibot 1.5.0, arktype 2.2.8 |
| Licence | MIT | MIT | MIT | MIT |
| Téléchargements par semaine | environ 326 millions | environ 12 millions | non vérifié | valibot environ 22 millions, arktype environ 2 millions |
| Décorateurs | aucun | mode legacy exigé pour tout le programme | aucun | aucun |
| Type issu du schéma | oui, déduit | la classe est le type, écrite à la main | oui, déduit (`Static`) | oui, déduit |
| JSON Schema pour le contrat | intégré (`z.toJSONSchema`, draft 2020-12) | par `class-validator-jsonschema`, un *package* séparé | le schéma est du JSON Schema | celui de la bibliothèque quand elle implémente Standard JSON Schema (vérifié avec zod 4 ; arktype, et valibot par `@valibot/to-json-schema`, non vérifiés), ou celui que vous fournissez |
| Partagé une fois dans le contrat | `.meta({ id })`, conservé une fois imbriqué | `classSchema(Dto, { shared: true })` ; une classe imbriquée l'est toujours | `$id` dans les options, conservé une fois imbriqué | les identifiants de la bibliothèque, ou `sharedSchema(name, schema)` |
| Réutilisation partielle | `.pick`, `.omit`, `.partial`, `.extend` | `pickClass`, `omitClass`, `partialClass` du kit, `extends` | `Type.Pick`, `Type.Omit`, `Type.Partial`, `Type.Intersect` (garde la référence) ou `Type.Interface` (une copie à plat) | celle de la bibliothèque (`v.pick`, `v.omit`, ...) |
| Codes d'anomalie | ceux de la bibliothèque (`too_small`, ...) | le nom de la contrainte | le mot-clé JSON Schema (`minLength`, `format`) | toujours `invalid` |
| Coût d'une analyse, mesuré ([paires de contrat](contract-pairs.fr.md)) | environ 0,5 µs | environ 5 à 9 µs | environ 6 à 11 µs (sa propre vérification seule, 0,75 µs) | non mesuré |
| Schémas asynchrones | pas à la frontière | pas à la frontière | pas à la frontière | `parse` lève une erreur |

### Le même corps dans chaque bibliothèque

Le corps de la route de réservation, quatre fois. Chaque version aboutit au même `Schema`,
qu'une route prend tel quel.

class-validator, avec les décorateurs legacy et `reflect-metadata` :

<!-- checked sample: legacy-decorators -->
```ts
import 'reflect-metadata';
import { IsISO8601, IsUUID } from 'class-validator';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';

class BookAppointmentDto {
  @IsUUID() practitionerId = '';
  @IsISO8601({ strict: true }) startsAt = '';
  @IsISO8601({ strict: true }) endsAt = '';
}

// parse renvoie une instance de BookAppointmentDto ; une propriété non déclarée est une anomalie
export const bookAppointmentBody = classSchema(BookAppointmentDto);
```

TypeBox, dont le schéma est déjà du JSON Schema :

<!-- checked sample -->
```ts
import Type from 'typebox';
import { typeboxSchema } from '@ddd-ts-kit/validation/typebox';

// les codes d'anomalie sont les mots-clés JSON Schema : 'required' pour endsAt, 'format' pour practitionerId
export const bookAppointmentBody = typeboxSchema(
  Type.Object({
    practitionerId: Type.String({ format: 'uuid' }),
    startsAt: Type.String({ format: 'date-time' }),
    endsAt: Type.String({ format: 'date-time' }),
  }),
);
```

valibot par Standard Schema, avec le JSON Schema du contrat donné à la main :

<!-- checked sample -->
```ts
import * as v from 'valibot';
import { standardSchema } from '@ddd-ts-kit/validation/standard-schema';

const instant = { type: 'string', format: 'date-time' };

// chaque anomalie a le code 'invalid' ; sans le second argument, le contrat montrerait {}
export const bookAppointmentBody = standardSchema(
  v.object({
    practitionerId: v.pipe(v.string(), v.uuid()),
    startsAt: v.pipe(v.string(), v.isoTimestamp()),
    endsAt: v.pipe(v.string(), v.isoTimestamp()),
  }),
  {
    type: 'object',
    required: ['practitionerId', 'startsAt', 'endsAt'],
    properties: { practitionerId: { type: 'string', format: 'uuid' }, startsAt: instant, endsAt: instant },
  },
);
```

zod est le premier exemple de cette page.

## Critères de choix

1. **Le contrat.** Les documents OpenAPI et AsyncAPI sont générés à partir de
   `toJsonSchema()`. Une bibliothèque qui ne sait pas se décrire produit un contrat vide, sauf si
   vous écrivez le JSON Schema deux fois.
2. **Mode des décorateurs.** class-validator impose `experimentalDecorators` au programme. Les
   décorateurs propres au kit fonctionnent dans les deux modes, mais d'autres bibliothèques
   peut-être pas.
3. **Ce que l'équipe a déjà.** Une base de code NestJS contient en général des centaines de
   classes DTO ; les réécrire n'apporte rien.
4. **Détail des erreurs.** Des clients qui aiguillent sur les codes d'anomalie ont besoin d'une
   bibliothèque qui en fournit.
5. **Maintenance.** class-validator publie encore ; son compagnon class-transformer n'a publié
   aucune version depuis 2021 (vérifié ce jour). C'est un fait à peser, pas un verdict : le
   *package* est petit et stable.

## Ce que ce kit prend en charge et a vérifié

D'après [`packages/validation/README.md`](../../packages/validation/README.fr.md) :

- **zod.** `zodSchema(schema, { io? })`. Le JSON Schema vient de l'export propre à zod 4 et
  s'utilise tel quel dans OpenAPI 3.1 ; il décrit par défaut le côté entrée, `{ io: 'output' }`
  pour un corps de réponse. `.describe(...)` sur un champ se retrouve dans le catalogue des
  événements et dans le contrat.
- **class-validator.** `classSchema(Dto, options?)`. `parse` renvoie une instance de la classe ;
  `whitelist` et `forbidNonWhitelisted` sont actifs par défaut, si bien qu'une propriété non
  déclarée est une anomalie ; les erreurs imbriquées sont mises à plat (`items.0.quantity`), une
  anomalie par contrainte en échec ; les classes imbriquées atterrissent sous `$defs`. Il faut
  `class-transformer`, `class-validator-jsonschema` et `reflect-metadata`, et
  `experimentalDecorators` dans le projet.
- **Standard Schema.** `standardSchema(schema, jsonSchema?, { io? })` accepte toute bibliothèque
  qui l'implémente ; sans JSON Schema, il documente celui que la bibliothèque convertit
  elle-même par Standard JSON Schema, quand elle l'implémente et sait convertir ce schéma
  (vérifié avec zod 4), sinon `{}`.
- **Schémas partagés.** Une forme déclarée une fois est documentée une fois : le générateur
  OpenAPI l'écrit dans `components.schemas` et chaque route y renvoie, entière ou imbriquée.
  `sharedSchema(name, schema)` partage n'importe quel `Schema` ; la plateforme partage
  `acceptedSchema` (`Accepted`), la page d'un élément partagé (`<Item>Page`) et le document
  *problem*. Sous `"stack.schemas": "shared"` (un nouveau projet), `generate schema` en écrit un
  et `schema/no-duplicate-shape` signale une forme déclarée deux fois dans un même contexte
  ([configuration](../CONFIG.fr.md)).
- `customSchema(parse, jsonSchema?)` construit un schéma à partir d'une simple fonction, pour la
  rare entrée qu'aucune bibliothèque ne décrit :

<!-- checked sample -->
```ts
import { err, ok } from '@ddd-ts-kit/kernel';
import { customSchema } from '@ddd-ts-kit/validation';

// une référence de praticien écrite "<practiceId>.<practitionerId>", découpée à l'entrée
export const practitionerKey = customSchema(
  (input: unknown) => {
    const [practiceId, practitionerId, ...rest] = typeof input === 'string' ? input.split('.') : [];

    return practiceId && practitionerId && rest.length === 0
      ? ok({ practiceId, practitionerId })
      : err([{ path: '', code: 'practitioner_key', message: 'Expected <practiceId>.<practitionerId>' }]);
  },
  { type: 'string', pattern: '^[^.]+\\.[^.]+$' },
);
```

- L'entrée racine n'importe aucun *package* tiers ; chaque adaptateur est un sous-chemin avec sa
  bibliothèque en dépendance *peer* facultative.
- La CLI génère des fichiers DTO avec class-validator, et des schémas sinon ; la « *stack* de
  premier rang » prouvée de bout en bout par la CLI utilise `--validation class-validator` dans
  le mode legacy des décorateurs, et la *stack* par défaut utilise zod
  ([`packages/cli/README.md`](../../packages/cli/README.fr.md)).

## Limites, et quand ne pas l'utiliser

- **L'adaptateur Standard Schema et le contrat.** Standard Schema lui-même n'a pas d'export JSON
  Schema ; sa spécification compagne, Standard JSON Schema (V1), en a un, et l'adaptateur le lit
  quand la bibliothèque l'implémente (zod 4 le fait, vérifié avec 4.6.5 ; valibot seulement par
  `toStandardJsonSchema` de `@valibot/to-json-schema`). Pour toute autre bibliothèque, passez le
  JSON Schema à la main ou acceptez un contrat vide pour cette entrée.
- **class-validator en partie.** `pickClass`, `omitClass` et `partialClass` copient les
  métadonnées de class-validator et de class-transformer sur une nouvelle classe destinée à être
  étendue. Une classe dérivée imbriquée dans une autre par `@Type` déclare une propriété à elle,
  parce que class-validator-jsonschema ne documente une classe qu'à partir de ses propres
  décorateurs.
- **Deux formes sous un même nom.** zod documente différemment le côté entrée et le côté sortie
  d'un schéma avec valeurs par défaut : un schéma partagé utilisé comme corps et comme réponse
  donne deux composants (`Slot`, `Slot_2`). Donnez à la réponse un identifiant à elle.
- **Codes d'anomalie de Standard Schema.** La spécification n'en porte aucun : chaque anomalie a
  le code `invalid`.
- **Pas de validation asynchrone à la frontière** : un schéma qui valide de façon asynchrone fait
  lever une erreur à `parse`. Une vérification qui a besoin d'entrées-sorties (ce praticien
  existe-t-il ?) n'est pas de la validation ; elle appartient au cas d'usage.
- **class-validator renvoie des instances de classe**, et la transformation passe par
  class-transformer : un DTO avec des valeurs par défaut ou des conversions `@Type` change ce que
  reçoit le gestionnaire. Gardez les DTO sans comportement.
- **Les chaînes de requête sont des chaînes.** La conversion (`z.coerce.number()`,
  `@Type(() => Number)`) fait partie du schéma.
- **Un schéma n'est pas un modèle.** Réutiliser un schéma de présentation dans `application/` ou
  `domain/` est un défaut que signalent les règles des couches ; un schéma de réponse est un DTO
  de présentation, obtenu à partir du modèle.
- **Resserrer un schéma sur une API déployée est un changement cassant** pour les clients qui
  envoyaient ce qui était toléré jusque-là.

Ne sortez pas une bibliothèque de validation pour protéger un agrégat : le `create` d'un
objet-valeur le fait, avec une `DomainError` et un code stable, et cela tient pour chaque
appelant.

## Recommandation selon la situation

| Situation | Choix |
|---|---|
| Nouveau projet, aucune contrainte | zod : le défaut du kit, des types déduits, le contrat généré sans seconde description |
| NestJS, ou une base existante de classes DTO décorées | class-validator : gardez les DTO, acceptez le mode legacy des décorateurs |
| Le contrat doit être exactement le schéma, ou Fastify est déjà en place | TypeBox : le schéma est du JSON Schema, composé avec `Type.Pick`, `Type.Omit`, `Type.Intersect` |
| L'équipe s'est déjà standardisée sur valibot ou arktype, ou la taille du bundle à l'edge compte | adaptateur Standard Schema, avec le JSON Schema fourni pour chaque entrée publique |
| Charges utiles des événements d'intégration | la même bibliothèque que pour les routes : un seul vocabulaire de schémas pour les deux contrats |
| Une entrée qu'aucune bibliothèque ne décrit | `customSchema`, avec son JSON Schema |

Mélanger est possible (n'importe quel `Schema` fonctionne dans une route) et rarement sage : deux
vocabulaires d'anomalies dans une même API embrouillent ses clients.

## Sources

- Documentation de zod, conversion en JSON Schema : https://zod.dev/json-schema
- class-validator : https://github.com/typestack/class-validator ; class-transformer :
  https://github.com/typestack/class-transformer (activité des dépôts et versions publiées lues
  le 2026-10-10)
- Standard Schema et Standard JSON Schema : https://standardschema.dev
- valibot : https://valibot.dev ; arktype : https://arktype.io
- TypeBox : https://github.com/sinclairzx81/typebox
- Registre npm : versions, licences et téléchargements hebdomadaires lus le 2026-10-10.
- JSON Schema draft 2020-12 : https://json-schema.org/draft/2020-12
- Standard JSON Schema lu par l'adaptateur : vérifié avec zod 4.6.5, dont les schémas
  implémentent `~standard.jsonSchema` (`input` et `output`, cible `draft-2020-12`) ; non vérifié
  avec arktype ni avec `@valibot/to-json-schema`.

## Voir aussi

- [Frameworks HTTP](http-frameworks.fr.md)
- [Invariants, permissions et validation](../concepts/invariants-permissions-validation.fr.md)
- [Entités et objets-valeurs](../concepts/entities-and-value-objects.fr.md)
- [Versionner un événement d'intégration](../concepts/event-versioning.fr.md)
- [Référence de l'architecture](../ARCHITECTURE.fr.md)
