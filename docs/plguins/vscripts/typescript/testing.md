# Testing VScripts written with TypeScript

One of the most important advantages of using TypeScript is an easy way to test your addon.

Unfortunately, currently there is no tool that allows you to test code, that uses dota-related API,
but you can easily test everything else in a node environment.

To test your code you can use jest.

## Configuration

> Jest configuration is already included in projects initialized with a
> [CLI](/getting-started/from-scratch).

package.json:

```json
{
  // ...
  "jest": {
    "match": "TODO:"
  }
}
```

---

Here's the example content of a module we're going to test:

src/vscripts/math.ts:

```ts
export const plus = (a, b) => a + b;
```

And a representative test file:

src/vscripts.test/math.ts:

```ts
// !!/* is an alias for src/vscripts/*
import { plus } from '!!/math';

describe('plus', () => {
  test('should work with positive numbers', () => expect(plus(1, 2)).toBe(3));
  test('should work with negative numbers', () => expect(plus(-1, -2)).toBe(-3));
  test('should work with mixed numbers', () => expect(plus(5, -2)).toBe(3));
});
```

For more information about writing tests check out [Jest documentation](https://jestjs.io/).
