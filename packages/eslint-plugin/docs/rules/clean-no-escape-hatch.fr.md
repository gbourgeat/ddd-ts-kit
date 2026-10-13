[English](clean-no-escape-hatch.md) · **Français**
<!-- translation-of: clean-no-escape-hatch.md sha256:26ab37e5d373a584 -->

# ddd-ts-kit/clean-no-escape-hatch

Identifiant d'architecture : `clean/no-escape-hatch`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier passé au lint.

## Pourquoi

Chaque échappatoire éteint le compilateur pour une valeur et pour tout ce qu'elle touche. Les données étrangères entrent par les *mappers* et les adaptateurs, où une assertion est attendue ; partout ailleurs, elle cache un problème de conception.

## Signalé

- `value as X` et `<X>value` hors de `*.mapper.ts`, de `infrastructure/**` d'un contexte et des fichiers reconnus par `adapterGlobs` (`as const`, `as unknown` et `satisfies` sont permis ; `as unknown as X` est signalé une fois)
- `eslint-disable`, `eslint-disable-line` et `eslint-disable-next-line` sans raison après `--`

Incorrect :

```ts
const invoice = raw as Invoice;
// eslint-disable-next-line no-console
console.log(invoice);
```

Correct :

```ts
const invoice = parseInvoice(raw);
const roles = ['admin', 'agent'] as const;
// eslint-disable-next-line no-console -- la CLI affiche son résultat
console.log(invoice);
```

## Détails

**Délégué aux règles standard.** Le reste de la règle d'architecture est tenu par typescript-eslint, activé par chaque préréglage de ce *plugin* au lieu d'être écrit une seconde fois :

| Partie de `clean/no-escape-hatch` | Règle standard |
|---|---|
| `any` explicite | `@typescript-eslint/no-explicit-any` |
| assertion de non-nullité `!` | `@typescript-eslint/no-non-null-assertion` |
| `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` sans description | `@typescript-eslint/ban-ts-comment` (`ts-expect-error: allow-with-description`) |

Activer `ddd-ts-kit/clean-no-escape-hatch` seule ne signale donc pas ces trois cas : utilisez un préréglage, ou activez les trois règles à côté d'elle.

## Options

| Option | Défaut | Sens |
|---|---|---|
| `typeAssertions` | `true` | `false` ne garde que la vérification des commentaires (les préréglages l'utilisent pour les tests) |
| `adapterGlobs` | `[]` | d'autres endroits où entrent des données étrangères, où une assertion est attendue |
| `allowCallerClaimedGenerics` | `false` | laisse passer `value as T` quand c'est l'appelant qui a choisi `T` |

**`adapterGlobs`.** L'exemption des adaptateurs se lit au chemin : `*.mapper.ts` partout, et `infrastructure/` d'un contexte. Un projet qui garde des adaptateurs ailleurs (la plateforme, un *package* d'un monorepo) les déclare :

```js
'ddd-ts-kit/clean-no-escape-hatch': ['error', { adapterGlobs: ['src/platform/database/**', 'packages/*/src/postgres/**'] }]
```

Les globs sont des chemins posix relatifs à la racine du projet (le répertoire de `ddd-ts-kit.config.json`, sinon le répertoire de travail) : `**` traverse les répertoires, `*` reste dans un seul, `?` est un caractère. Rien ne change à l'intérieur d'un contexte.

**`allowCallerClaimedGenerics`.** Une fonction comme `get<Body>(path): Promise<Body>` ne peut pas connaître `Body` : c'est l'appelant qui l'affirme. Avec l'option, `value as T` est accepté quand `T` est exactement un paramètre de type de la fonction ou de la méthode qui l'entoure et que ce paramètre apparaît dans son type de retour déclaré.

```ts
async get<Body>(path: string): Promise<Body> {
  return (await this.read(path)) as Body; // accepté avec l'option
}
```

Le compromis : rien ne vérifie l'affirmation. `client.get<Invoice>('/x')` est une assertion écrite par l'appelant, dans n'importe quelle couche, qu'aucune règle ne voit plus. Gardez l'option désactivée là où un schéma peut analyser la valeur, et activez-la pour les quelques utilitaires de transport dont les appelants valident ce qu'ils reçoivent. `value as T[]`, un paramètre de type d'une classe et une fonction qui ne renvoie pas `T` restent signalés.

`rules."clean/no-escape-hatch"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line clean/no-escape-hatch -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un `/* eslint-disable */` global fait aussi taire cette règle, qui ne peut donc pas le signaler : `governance/recorded-deviation` le fait.
- Le `any` produit par l'inférence est l'affaire des règles `no-unsafe-*` de typescript-eslint, qui s'appuient sur les types.

## Avec le checker de la CLI

`ddd-ts-kit check` approche cette règle sur le texte du fichier et reste le garde-fou rapide pendant l'écriture. Cette règle fait autorité.
