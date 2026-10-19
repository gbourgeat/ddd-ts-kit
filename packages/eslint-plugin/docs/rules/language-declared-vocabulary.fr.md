[English](language-declared-vocabulary.md) · **Français**
<!-- translation-of: language-declared-vocabulary.md sha256:a297ca03357580ce -->

# ddd-ts-kit/language-declared-vocabulary

Identifiant d'architecture : `language/declared-vocabulary`. Sévérité par défaut : `error`.

S'applique à : chaque source sous la racine des sources d'un projet dont la configuration dit `"stack.literals": "named"`, ce qu'écrit `init` (une configuration qui ne dit rien, comme avant la 0.6, garde la règle silencieuse) ; sont exclus les tests, les langages publiés, le schéma des relations du modèle d'accès, le fichier qui déclare une valeur et, hors de `domain/`, un mot typé par un autre langage.

## Pourquoi

Un statut, une sorte, un rôle ou une permission est un mot du langage dont les valeurs forment une liste fermée. Réécrite comme une chaîne partout où elle est comparée, accordée ou stockée, chaque copie peut dériver : une faute de frappe compile, une valeur renommée laisse son ancienne graphie derrière elle, et rien ne la complète dans l'éditeur. Déclarée une fois, elle se lit par sa clé, l'éditeur la complète, et un paramètre typé par elle n'accepte rien d'autre. La valeur reste la même chaîne sur le réseau et dans la base de données.

## Signalé

Un littéral de chaîne, ou un littéral de gabarit sans substitution, dont la valeur est une valeur d'un vocabulaire fermé que le projet déclare :

- un objet `as const` de valeurs chaînes exporté à côté du type union du même nom, `export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus]` (ce qu'écrit `ddd-ts-kit generate vocabulary`, et le `Role` de la plateforme) ;
- un ensemble de permissions, `export const billingPermissions = definePermissions('billing', { 'invoice.issue': .. })`, qui déclare l'identifiant `billing:invoice.issue`.

Incorrect :

```ts
if (appointment.status === 'no-show') {
  grants.push('billing:invoice.issue');
}
```

Correct :

```ts
if (appointment.status === AppointmentStatus.NoShow) {
  grants.push(billingPermissions['invoice.issue']);
}
```

## Où une valeur est jugée

Un mot signifie une chose dans un contexte, et peut signifier autre chose dans le contexte voisin ; la règle suit le langage de chaque endroit.

| Déclarée dans | Jugée dans |
|---|---|
| un contexte (`domain/vocabularies/` de `billing`) | ce contexte seulement : `issued` dans `catalog` est un autre mot |
| la plateforme (le `Role` de `<platformDir>/auth/authorization/role.ts`) | la plateforme, et les groupes de routes `*.routes.ts` des contextes, où une garde nomme un rôle |
| le noyau partagé | partout |
| un ensemble de permissions (`definePermissions`) | partout : un identifiant de permission nomme une permission d'un contexte |

## Détails

Une clé entre guillemets est une valeur réécrite et elle est signalée : écrivez-la comme une clé calculée, `[AppointmentStatus.NoShow]: 'No show'`, ce qui type aussi l'objet par le vocabulaire. Une clé identifiant et le spécificateur d'un import ou d'un export sont des noms et ne sont pas jugés. Dans la persistance d'un contexte (`infrastructure/persistence/`), le nom d'une colonne, d'une table ou d'un schéma est un mot du stockage et n'est pas jugé : le premier argument d'un appel (`text('note')`, `createTable('invoice')`, `.where('note', ..)`) et la valeur de `name`, `tableName` ou `schema` ; une valeur stockée, l'argument de `.default(..)` ou une valeur comparée dans une requête, l'est. Un test écrit volontairement les valeurs qu'envoie un client, et un langage publié nomme lui-même les valeurs de son contrat : ni l'un ni l'autre n'est jugé. Le message nomme le vocabulaire, le fichier qui le déclare et ce qu'il faut écrire à la place.

Un mot d'un autre langage qui épelle une valeur du contexte (catalog publie un `state` valant `'draft' | 'issued'`, et billing déclare son propre `InvoiceStatus`) n'est pas celui du contexte, et n'est pas jugé hors de `domain/` quand son type le dit : une clé d'un objet typé `Record<T, ..>`, une valeur chaîne d'un objet typé `Record<.., T>` (par l'annotation de sa déclaration ou par `satisfies`, `as const` et `Readonly`, `Partial` ou `Required` autour permis), ou un littéral écrit `'issued' satisfies T` dans une comparaison ou un `case`. `T` est une seule référence de type (`ProductListedV1Payload['state']`, `typeof x`, `keyof typeof x`, pas une union) dont le nom est importé d'un langage publié (celui de son propre contexte compris), importé comme type d'un paquet (`import type` ou `import { type X }`), ou importé de ou déclaré dans `infrastructure/anti-corruption/` ou `infrastructure/external/` ; dans ces deux dossiers, les types littéraux d'une interface ou d'un alias de type, qui décrivent un enregistrement extérieur tel qu'il arrive, ne sont pas jugés non plus. Le compilateur vérifie alors l'orthographe : une clé qui n'est pas une valeur de `T` arrête la compilation. Quand le fichier lit un autre langage et qu'un littéral reste signalé, le message dit quels types il y lit et comment typer le littéral par l'un d'eux (message `rawBesideOtherLanguage`). Le premier choix reste en amont : un producteur qui déclare ses valeurs fermées comme un vocabulaire de son langage publié laisse le consommateur les lire par leur clé.

```ts
import type { ProductListedV1Payload } from '@/contexts/catalog/published-language/product-listed.v1.payload.js';

// Signalé : un mot de catalog comparé sans le dire.
const listedAsIssued = payload.state === 'issued';

// Non signalé : la comparaison et les clés sont typées par le contenu de catalog.
const issued = payload.state === ('issued' satisfies ProductListedV1Payload['state']);
const statusOf = {
  'draft': InvoiceStatus.Draft,
  'issued': InvoiceStatus.Issued,
} as const satisfies Record<ProductListedV1Payload['state'], InvoiceStatus>;
```

## Options

Aucune.

`rules."language/declared-vocabulary"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line language/declared-vocabulary -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Les vocabulaires se lisent dans les fichiers de la racine des sources sur le disque, de nouveau dès qu'une lecture a cinq secondes : un éditeur voit une nouvelle valeur après quelques secondes, une exécution du lint lit le projet à peu près une fois.
- La déclaration est analysée : une `const` exportée dont la valeur est un objet `as const` (ou `as const satisfies ..`), chaque entrée étant une clé (un nom ou une chaîne entre guillemets) et un littéral de chaîne, avec l'un ou l'autre type de guillemets, commentaires permis, à côté de `export type X = (typeof X)[keyof typeof X]` écrit de cette façon. Un objet avec un nombre, un étalement, une méthode ou une entrée calculée, ou sans ce type union, ne déclare rien. `generate vocabulary` écrit la forme qui est lue.
- Une valeur de la plateforme est reconnue par sa valeur dans chaque fichier de la plateforme : avec le `Role` d'un projet rbac, `actor.type === 'system'` dans la plateforme est signalé alors qu'il compare une sorte d'acteur, pas un rôle. Déclarez ce mot dans son propre vocabulaire (`ActorType.System`) et lisez-le là, ou faites taire la ligne avec sa raison.
- Une valeur que partagent deux vocabulaires est signalée avec les deux : le message nomme chacun et ce qu'il faut écrire pour chacun.
- Un mot d'un autre langage est reconnu par le type avec lequel il est écrit, que la règle lit sans information de type et auquel elle fait confiance : un type étranger qui vaut `string` ne vérifie rien, et un alias local d'un type étranger hors de `infrastructure/anti-corruption/` et `infrastructure/external/` n'est pas reconnu. Une comparaison ou un `case` n'est pas typé par le discriminant auquel il est comparé : `switch (payload.state) { case 'issued': }` est signalé, `case 'issued' satisfies ProductListedV1Payload['state']:` ne l'est pas.

## Avec le checker de la CLI

`ddd-ts-kit check` tient la même règle sur le texte des fichiers du projet, avec les mêmes déclarations et les mêmes exemptions.
