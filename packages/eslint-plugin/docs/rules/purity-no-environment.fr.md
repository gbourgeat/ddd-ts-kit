[English](purity-no-environment.md) · **Français**
<!-- translation-of: purity-no-environment.md sha256:101d62840f5a83f6 -->

# ddd-ts-kit/purity-no-environment

Identifiant d'architecture : `purity/no-environment`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/` et `application/` d'un contexte, tests exclus.

## Pourquoi

La configuration, les journaux, les fichiers et le réseau sont le monde extérieur. Atteints directement, ils font dépendre un cas d'usage de la machine sur laquelle il tourne ; derrière un port, ils sont un paramètre.

## Signalé

- `process.env`, `argv`, `cwd`, `exit`, `stdout`, `stderr`, `stdin`
- tout membre de `console`
- un appel du `fetch` global, `new XMLHttpRequest`, `new WebSocket`, `new EventSource`
- un import de `fs`, `http`, `https`, `http2`, `net`, `dgram`, `dns`, `tls`, `child_process`, `worker_threads`, `os`, `readline`, `axios`, `node-fetch`, `undici`, `got`, `dotenv`

Incorrect :

```ts
const url = process.env['PAYMENT_URL'];
console.log('charging', amount);
await fetch(url);
```

Correct :

```ts
await this.paymentGateway.charge(amount);
```

## Options

Aucune.

`rules."purity/no-environment"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line purity/no-environment -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une enveloppe autour de l'accès interdit (un auxiliaire de la plateforme qui appelle `Date.now()`) n'est pas vue ici ; les règles de couche arrêtent l'import de cet auxiliaire.
- Une déclaration locale qui masque la globale (`const process = ...`) n'est pas signalée.
- Un membre pris par déstructuration (`const { env } = process`, `const { now } = Date`) et un alias `const` de la globale (`const clock = Date; clock.now()`) sont lus ; un alias par un `let`, un paramètre ou une propriété n'est pas suivi.

## Avec le checker de la CLI

`ddd-ts-kit check` cherche les mêmes noms avec des expressions régulières. Cette règle fait autorité : elle distingue un nom masqué de la globale, et du code d'une chaîne.
