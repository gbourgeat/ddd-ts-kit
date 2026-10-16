[English](language-declared-vocabulary.md) · **Français**
<!-- translation-of: language-declared-vocabulary.md sha256:a438233da76f086c -->

# ddd-ts-kit/language-declared-vocabulary

Identifiant d'architecture : `language/declared-vocabulary`. Sévérité par défaut : `error`.

S'applique à : chaque source sous la racine des sources d'un projet dont la configuration dit `"stack.literals": "named"`, ce qu'écrit `init` (une configuration qui ne dit rien, comme avant la 0.6, garde la règle silencieuse) ; sont exclus les tests, les langages publiés, le schéma des relations du modèle d'accès et le fichier qui déclare une valeur.

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
| la plateforme (le `Role` de `<platformDir>/auth/role.ts`) | la plateforme, et les groupes de routes `*.routes.ts` des contextes, où une garde nomme un rôle |
| le noyau partagé | partout |
| un ensemble de permissions (`definePermissions`) | partout : un identifiant de permission nomme une permission d'un contexte |

## Détails

Une clé entre guillemets est une valeur réécrite et elle est signalée : écrivez-la comme une clé calculée, `[AppointmentStatus.NoShow]: 'No show'`, ce qui type aussi l'objet par le vocabulaire. Une clé identifiant et le spécificateur d'un import ou d'un export sont des noms et ne sont pas jugés. Dans la persistance d'un contexte (`infrastructure/persistence/`), le nom d'une colonne, d'une table ou d'un schéma est un mot du stockage et n'est pas jugé : le premier argument d'un appel (`text('reason')`, `createTable('expense')`, `.where('reason', ..)`) et la valeur de `name`, `tableName` ou `schema` ; une valeur stockée, l'argument de `.default(..)` ou une valeur comparée dans une requête, l'est. Un test écrit volontairement les valeurs qu'envoie un client, et un langage publié nomme lui-même les valeurs de son contrat : ni l'un ni l'autre n'est jugé. Le message nomme le vocabulaire, le fichier qui le déclare et ce qu'il faut écrire à la place.

## Options

Aucune.

`rules."language/declared-vocabulary"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line language/declared-vocabulary -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Les vocabulaires se lisent dans les fichiers de la racine des sources sur le disque, de nouveau dès qu'une lecture a cinq secondes : un éditeur voit une nouvelle valeur après quelques secondes, une exécution du lint lit le projet à peu près une fois.
- La déclaration est analysée : une `const` exportée dont la valeur est un objet `as const` (ou `as const satisfies ..`), chaque entrée étant une clé (un nom ou une chaîne entre guillemets) et un littéral de chaîne, avec l'un ou l'autre type de guillemets, commentaires permis, à côté de `export type X = (typeof X)[keyof typeof X]` écrit de cette façon. Un objet avec un nombre, un étalement, une méthode ou une entrée calculée, ou sans ce type union, ne déclare rien. `generate vocabulary` écrit la forme qui est lue.
- Une valeur de la plateforme est reconnue par sa valeur dans chaque fichier de la plateforme : avec le `Role` d'un projet rbac, `actor.type === 'system'` dans la plateforme est signalé alors qu'il compare une sorte d'acteur, pas un rôle. Déclarez ce mot dans son propre vocabulaire (`ActorType.System`) et lisez-le là, ou faites taire la ligne avec sa raison.
- Une valeur que partagent deux vocabulaires est signalée avec les deux : le message nomme chacun et ce qu'il faut écrire pour chacun.

## Avec le checker de la CLI

`ddd-ts-kit check` tient la même règle sur le texte des fichiers du projet, avec les mêmes déclarations et les mêmes exemptions.
