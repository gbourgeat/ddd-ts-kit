[English](schema-presentation-only.md) · **Français**
<!-- translation-of: schema-presentation-only.md sha256:31923423ed8a25fa -->

# ddd-ts-kit/schema-presentation-only

Identifiant d'architecture : `schema/presentation-only`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : les fichiers de production du noyau partagé et de `domain/`, `application/`, `infrastructure/` et `published-language/` d'un contexte, dans un projet dont la configuration dit `"stack.schemas": "shared"`.

## Pourquoi

Un schéma dit ce qu'un client envoie ou reçoit : c'est un type de présentation, et il change avec le contrat HTTP, pas avec le modèle. Le noyau partagé est importé par chaque couche de chaque contexte, si bien qu'un schéma écrit là atteint le domaine et les cas d'usage. Un schéma par lequel plusieurs contextes répondent vit sous `presentation/` du noyau partagé, et seules les couches de présentation l'importent.

## Signalé

- dans le noyau partagé hors de `presentation/`, un import d'une bibliothèque de validation : zod, class-validator, class-transformer, class-validator-jsonschema, valibot, arktype, TypeBox, `@ddd-ts-kit/validation`
- dans `domain/`, `application/`, `infrastructure/` et `published-language/` d'un contexte, et dans le noyau partagé hors de `presentation/`, un import d'un fichier de `presentation/` du noyau partagé

Incorrect :

```ts
// shared-kernel/money.ts
import { IsInt, IsString } from 'class-validator';
export class Money { @IsInt() cents = 0; @IsString() currency = ''; }
```

Correct :

```ts
// shared-kernel/presentation/money.schema.ts, importé par les couches de présentation seulement
import { IsInt, IsString } from 'class-validator';
export class Money { @IsInt() cents = 0; @IsString() currency = ''; }
```

## Options

Aucune.

`rules."schema/presentation-only"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line schema/presentation-only -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une bibliothèque de validation importée par `domain/` ou `application/` d'un contexte est signalée par `layer/domain-purity` et `layer/application-inward`, pas ici. Une bibliothèque importée par `infrastructure/` est permise : un adaptateur peut vérifier ce que répond un système distant.
- Les *specs* ne sont pas jugées.

## Avec le checker de la CLI

`ddd-ts-kit check` tient la même règle sur le texte des imports ; `schema/no-duplicate-shape`, qui compare les formes d'un contexte entre elles et avec le noyau partagé, est tenue par le *checker* seul.
