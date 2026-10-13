[English](README.md) · **Français**
<!-- translation-of: README.md sha256:f6e272c251c007da -->

# @ddd-ts-kit/validation

Un seul contrat `Schema` pour la validation des entrées à la frontière, avec des adaptateurs pour
zod, class-validator, TypeBox et toute bibliothèque Standard Schema. Les routes, les DTO et le
générateur OpenAPI dépendent du contrat, si bien que la bibliothèque de validation peut changer
sans qu'on y touche.

Les règles métier n'ont pas leur place ici : elles vivent dans le domaine et n'importent jamais
de bibliothèque de validation.

![Une requête HTTP à la frontière : ses params, query, headers et body passent chacun par le Schema que la route déclare ; quand chaque partie est analysée, le gestionnaire reçoit des valeurs typées et le domaine vérifie les règles métier ; quand une partie échoue, ses problèmes sont rassemblés avec le nom de la partie devant leur chemin, comme body.items.0.sku, et la requête HTTP est refusée avec une seule ValidationError, code VALIDATION_FAILED, traduite en réponse 422 avec la liste des problèmes ; les mêmes schémas donnent le JSON Schema du document OpenAPI](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/validation-package-at-the-boundary.fr.svg)

Un schéma vérifie la **forme** de ce qui entre : types, champs obligatoires, formats, longueurs.
Ce que le métier décide (un créneau dans le passé, une quantité au-delà du stock) est vérifié par
le domaine, quel que soit le point d'entrée :

<!-- checked sample -->
```ts
import { z } from 'zod';
import { ConceptError } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

// Au lieu de : une règle métier cachée dans le schéma d'une route, qu'un job ou un consommateur ne rencontre jamais.
export const bookWithARule = zodSchema(
  z.object({ startsAt: z.iso.datetime() }).refine((body) => Date.parse(body.startsAt) > Date.now(), 'The slot is in the past.'),
);

// Écrivez : la forme dans le schéma...
export const book = zodSchema(z.object({ startsAt: z.iso.datetime() }));

// ... et la règle dans le domaine, avec son propre code de refus.
export class SlotError extends ConceptError {
  static inThePast(startsAt: Date) {
    return SlotError.refusal('SLOT_IN_THE_PAST', `The slot at ${startsAt.toISOString()} is in the past.`, {
      startsAt: startsAt.toISOString(),
    });
  }
}

export function startingAt(startsAt: Date, now: Date): Date {
  if (startsAt <= now) {
    throw SlotError.inThePast(startsAt);
  }

  return startsAt;
}
```

## Le contrat

```ts
import { parseOrThrow, type Infer, type Schema } from '@ddd-ts-kit/validation';

interface Schema<T> {
  parse(input: unknown): Result<T, ValidationIssue[]>;
  toJsonSchema(): JsonSchema;
}

type ValidationIssue = { path: string; code: string; message: string }; // path : "items.0.sku"
```

Un schéma est une valeur : une par entrée, confiée à la route ou à l'événement qui valide avec
elle. Il n'est jamais lié dans un conteneur, c'est donc une interface et non un port injectable
(une classe abstraite) : il n'y a rien à déclarer dans une racine de composition.

- `parse` ne lève jamais d'exception pour une entrée invalide : il renvoie `err(issues)`.
- `parseOrThrow(schema, input)` renvoie la valeur ou lève une `ValidationError`, une
  `DomainError` de code `VALIDATION_FAILED` qui porte les `issues`.
- `Infer<typeof schema>` donne le type analysé.
- `customSchema(parse, jsonSchema?)` construit un schéma à partir d'une simple fonction.
- `sharedSchema(name, schema)` documente un schéma une seule fois, sous `name` (voir
  [schémas partagés](#schémas-partagés)).

<!-- checked sample -->
```ts
import { err, ok } from '@ddd-ts-kit/kernel';
import { ValidationError, customSchema, parseOrThrow, type Infer } from '@ddd-ts-kit/validation';

// Un schéma à partir d'une simple fonction : une vérification écrite à la main, ou un double dans un test.
const quantity = customSchema(
  (input: unknown) =>
    typeof input === 'number' && Number.isInteger(input) && input > 0
      ? ok(input)
      : err([{ path: '', code: 'not_a_quantity', message: 'A positive whole number is expected.' }]),
  { type: 'integer', minimum: 1 },
);

type Quantity = Infer<typeof quantity>; // number

export const refused = quantity.parse('3'); // { ok: false, error: [{ path: '', code: 'not_a_quantity', ... }] }
export const three: Quantity = parseOrThrow(quantity, 3); // 3

try {
  parseOrThrow(quantity, 0);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.code, error.issues); // VALIDATION_FAILED [{ path: '', code: 'not_a_quantity', ... }]
  }
}
```

Le point d'entrée racine n'importe aucun *package* tiers. Chaque adaptateur vit dans son propre
sous-chemin et sa bibliothèque est une dépendance *peer* facultative : n'installez que celle que
vous utilisez.

## À la route

Une route de `@ddd-ts-kit/http` nomme un schéma pour chaque partie de la requête HTTP qu'elle
lit. Chaque partie est analysée avant l'exécution du gestionnaire (handler), les problèmes de
toutes les parties sont renvoyés ensemble, et le chemin de chaque problème commence par sa
partie :

<!-- checked sample -->
```ts
import { z } from 'zod';
import { defineRoute, executeRoute, type RawRequest } from '@ddd-ts-kit/http';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

const placeOrder = defineRoute(
  {
    method: 'POST',
    path: '/orders',
    operationId: 'placeOrder',
    summary: 'Place an order',
    request: {
      body: zodSchema(z.object({ items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() })).min(1) })),
    },
    responses: { 201: { description: 'The order is placed.', body: zodSchema(z.object({ lines: z.number() }), { io: 'output' }) } },
    security: false,
  },
  async ({ body }) => ({ status: 201, body: { lines: body.items.length } }), // body est typé : { items: { sku, quantity }[] }
);

const request = (body: unknown): RawRequest => ({ params: {}, query: {}, headers: {}, body, raw: undefined });

export const placed = await executeRoute(placeOrder, request({ items: [{ sku: 'A-1', quantity: 2 }] })); // 201, { lines: 1 }
export const refused = await executeRoute(placeOrder, request({ items: [{ sku: 'A-1', quantity: 0 }] }));
// 422, un corps problem+json avec le code VALIDATION_FAILED et
// issues: [{ path: 'body.items.0.quantity', code: 'too_small', message: 'Too small: expected number to be >0' }]
```

Le gestionnaire ne voit jamais une requête HTTP invalide, et le document OpenAPI de la route
décrit le même corps, à partir de `toJsonSchema()`.

## zod

```sh
npm i zod
```

<!-- checked sample -->
```ts
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

declare const input: unknown; // ce que portait la requête HTTP

const placeOrder = zodSchema(
  z.object({
    customerId: z.string().uuid(),
    items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() })).min(1),
  }),
);

const result = placeOrder.parse(input);
if (!result.ok) {
  console.log(result.error); // [{ path: 'items.0.sku', code: 'too_small', message: '...' }]
}
```

Le JSON Schema vient de `z.toJSONSchema` de zod 4 (draft 2020-12, utilisable tel quel dans
OpenAPI 3.1). Il décrit le côté entrée par défaut ; passez `{ io: 'output' }` pour un corps de
réponse. Un type que JSON Schema ne sait pas représenter (une `Date`, un `bigint`) est écrit `{}`
plutôt que de faire échouer la génération.

## class-validator

```sh
npm i class-validator class-transformer class-validator-jsonschema reflect-metadata
```

<!-- checked sample: legacy-decorators -->
```ts
import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';

class OrderItemDto {
  @IsString() sku = '';
  @IsInt() @Min(1) quantity = 0;
}

class PlaceOrderDto {
  @IsUUID() customerId = '';

  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @ArrayMinSize(1)
  items: OrderItemDto[] = [];
}

export const placeOrder = classSchema(PlaceOrderDto);
```

`parse` renvoie une instance de la classe. `whitelist` et `forbidNonWhitelisted` sont activés par
défaut : une propriété non déclarée est un problème. Modifiez-le avec
`classSchema(Dto, { validator: { forbidNonWhitelisted: false }, transform: { ... } })`. Les
erreurs imbriquées sont aplaties (`items.0.quantity`), un problème par contrainte en échec, le
nom de la contrainte en `code`. Le JSON Schema est en draft 2020-12 et porte sous `$defs` les
classes imbriquées atteignables depuis la classe.

Exige `experimentalDecorators` dans le `tsconfig.json` du projet.

Une classe DTO déclarée une fois est réutilisée entière (`classSchema(SlotDto, { shared: true })`,
ou imbriquée avec `@ValidateNested()` et `@Type`), étendue (`class BookBody extends SlotDto { ... }`)
ou en partie, par trois utilitaires qui copient les contraintes, les types imbriqués et les
transformations des propriétés qu'ils gardent :

<!-- checked sample: legacy-decorators -->
```ts
import { IsEmail, IsIn, IsISO8601, IsString, IsUUID } from 'class-validator';
import { omitClass, partialClass, pickClass } from '@ddd-ts-kit/validation/class-validator';

class AppointmentDto {
  @IsUUID() patientId = '';
  @IsISO8601() startsAt = '';
  @IsISO8601() endsAt = '';
  @IsIn(['booked', 'cancelled']) status = 'booked';
}

class PatientDto {
  @IsString() name = '';
  @IsEmail() email = '';
}

export class RescheduleBody extends pickClass(AppointmentDto, ['startsAt', 'endsAt']) {}
export class BookBody extends omitClass(AppointmentDto, ['status']) {}
export class EditPatientBody extends partialClass(PatientDto) {} // chaque propriété facultative, vérifiée quand elle est présente
```

La classe qui étend un utilitaire nomme la forme dans le contrat. Garder une propriété qui ne
porte aucune contrainte est refusé : la validation la retirerait comme inconnue. Une classe
dérivée imbriquée dans une autre par `@Type` déclare au moins une propriété qui lui est propre :
class-validator-jsonschema ne documente une classe qu'à partir de ses propres décorateurs.

## TypeBox

```sh
npm i typebox
```

<!-- checked sample -->
```ts
import Type from 'typebox';
import { typeboxSchema } from '@ddd-ts-kit/validation/typebox';

export const slot = Type.Object({ startsAt: Type.String({ format: 'date-time' }), minutes: Type.Integer({ default: 30 }) }, { $id: 'Slot' });
export const book = typeboxSchema(Type.Object({ patientId: Type.String({ minLength: 1 }), slot }));
export const page = typeboxSchema(Type.Object({ limit: Type.Integer() }), { coerce: true }); // chaînes de requête
```

Le schéma est compilé une fois (`typebox/compile`). `parse` remplit les valeurs par défaut et
retire les propriétés que le schéma ne déclare pas, comme le fait zod, puis vérifie ; le code du
problème est le mot-clé JSON Schema qui a échoué (`required`, `format`, `minLength`...).
`{ coerce: true }` convertit d'abord le texte vers les types déclarés, pour les paramètres de
chemin et les chaînes de requête. Un schéma TypeBox est déjà du JSON Schema : `toJsonSchema()` le
renvoie, un schéma imbriqué construit avec un `$id` étant déplacé sous `$defs` et référencé, pour
qu'il n'arrive qu'une fois dans le contrat ; un schéma qui a son propre `$id` est partagé. Une
propriété manquante est signalée à son propre chemin (`slot.startsAt`), comme zod la signale, et
deux schémas différents sous un même `$id` sont refusés. `Type.Pick`, `Type.Omit` et
`Type.Partial` réutilisent un schéma en partie, comme une nouvelle forme ;
`Type.Intersect([slot, Type.Object({...})])` l'étend et garde la partie partagée sous forme de
référence (`allOf: [{ $ref: Slot }, ...]`), tandis que `Type.Interface([slot], {...})` écrit une
nouvelle forme à plat. (`Type.Composite` appartient à `@sinclair/typebox` 0.34 et n'existe pas
dans TypeBox 1.)
Écrit pour le *package* `typebox`, version 1 (le successeur de `@sinclair/typebox`).

## Standard Schema (valibot, arktype, ...)

<!-- checked sample -->
```ts
import * as v from 'valibot';
import { standardSchema } from '@ddd-ts-kit/validation/standard-schema';

export const placeOrder = standardSchema(
  v.object({ customerId: v.pipe(v.string(), v.uuid()) }),
  // Facultatif : le JSON Schema du contrat, que cet adaptateur ne dérive pas.
  { type: 'object', required: ['customerId'], properties: { customerId: { type: 'string', format: 'uuid' } } },
);
```

L'adaptateur valide avec `~standard.validate` de Standard Schema v1. Le JSON Schema du contrat
est le second argument quand il est donné (écrit à la main, ou produit par l'exportateur de votre
bibliothèque) ; sinon, celui que la bibliothèque convertit elle-même quand elle implémente la
spécification compagne, Standard JSON Schema v1 (`~standard.jsonSchema` ; vérifié avec zod 4,
tandis qu'arktype et valibot par `toStandardJsonSchema` de `@valibot/to-json-schema` l'annoncent
mais ne sont pas vérifiés ici), côté entrée par défaut et
`standardSchema(schema, undefined, { io: 'output' })` pour une réponse ; sinon `{}`, que le
document OpenAPI affiche comme « n'importe quelle valeur ». Un schéma que la bibliothèque ne sait
pas écrire en JSON Schema (zod refuse `z.date()`, `z.coerce.date()`, `z.custom`) est lui aussi
documenté `{}` : passez son JSON Schema en second argument. La spécification ne porte aucun code
d'erreur, si bien que chaque problème a le code `invalid`. Un schéma qui valide de façon
asynchrone fait lever une exception à `parse` : les schémas asynchrones ne sont pas pris en
charge à la frontière.

## Schémas partagés

Un schéma que plusieurs routes utilisent est déclaré une fois et documenté une fois : le
générateur OpenAPI de `@ddd-ts-kit/http` l'écrit dans `components.schemas` et y renvoie par
`$ref` depuis chaque route, entier ou imbriqué. Un schéma est partagé quand son JSON Schema est
une référence à l'une de ses propres définitions
(`{ $ref: '#/$defs/Slot', $defs: { Slot: ... } }`), la forme que chaque bibliothèque atteint à sa
façon :

![Un schéma partagé sous le nom Slot : son JSON Schema est une référence à sa propre définition ; les routes reschedule et book l'utilisent, l'une entier et l'autre imbriqué dans son corps ; le générateur OpenAPI écrit Slot une seule fois sous components.schemas et y renvoie par $ref depuis les deux routes, au lieu de deux copies](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/validation-package-shared-schemas.fr.svg)

<!-- checked sample -->
```ts
import Type from 'typebox';
import * as v from 'valibot';
import { z } from 'zod';
import { sharedSchema } from '@ddd-ts-kit/validation';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { standardSchema } from '@ddd-ts-kit/validation/standard-schema';
import { typeboxSchema } from '@ddd-ts-kit/validation/typebox';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

declare class PatientDto {
  name: string;
  email: string;
}

// zod : un id dans ses métadonnées, gardé quand le schéma est imbriqué dans un autre
const slot = z.object({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }).meta({ id: 'Slot' });
export const reschedule = zodSchema(slot);
export const book = zodSchema(z.object({ patientId: z.uuid(), slot }));

// class-validator : le nom de la classe
export const patient = classSchema(PatientDto, { shared: true });

// TypeBox : un $id dans ses options, gardé quand le schéma est imbriqué dans un autre
const money = Type.Object({ cents: Type.Integer(), currency: Type.String() }, { $id: 'Money' });
export const price = typeboxSchema(Type.Object({ amount: money }));

// n'importe quel schéma, ceux de Standard Schema compris
const amountSchema = v.object({ cents: v.pipe(v.number(), v.integer()) });
export const amount = sharedSchema('Amount', standardSchema(amountSchema));
```

`sharedNameOf(jsonSchema)` renvoie le nom sous lequel un JSON Schema est partagé, s'il y en a
un :

<!-- checked sample -->
```ts
import { customSchema, sharedNameOf, sharedSchema } from '@ddd-ts-kit/validation';

const amount = sharedSchema('Amount', customSchema((input) => ({ ok: true, value: input }), { type: 'integer' }));

export const jsonSchema = amount.toJsonSchema(); // { $ref: '#/$defs/Amount', $defs: { Amount: { type: 'integer' } } }
export const name = sharedNameOf(jsonSchema); // 'Amount'
```

Un schéma partagé de la couche présentation vit là où `generate schema` l'écrit : sous
`presentation/http/schemas/` de son contexte, ou sous `presentation/` du noyau partagé quand
plusieurs contextes répondent avec lui ; jamais dans le domaine.
