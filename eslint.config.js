// Lint for the places TypeScript's own checking can't see into. The game is JavaScript with JSDoc types, so there is
// no `any` keyword or `!` to ban: the ways round the checker are `any`-style JSDoc types, @ts-* comments and
// functions that return `any` (JSON.parse, response.json()). Run with: npm run lint
// (typescript-eslint's type-aware no-unsafe-* rules would also catch a stray `any`, but it can't run on TypeScript 7.)
import jsdoc from 'eslint-plugin-jsdoc';

const NOT_ANY = 'Use a real type, or `unknown` and narrow it.';

export default [
  {
    files: ['js/**/*.js'],
    plugins: { jsdoc },
    settings: {
      jsdoc: {
        mode: 'typescript',
        preferredTypes: {
          any: { message: NOT_ANY },
          '*': { message: NOT_ANY },
          Function: { message: 'Write the function type, e.g. (x: number) => void.' },
          Object: { message: 'Write the shape, or use `object` or Record<string, T>.' },
        },
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      // No `any`-like JSDoc types: {any}, {*}, {Function} and {Object} all switch checking off for the value.
      'jsdoc/check-types': 'error',
      // check-types only sees the outermost type, so also catch `any` inside others: Record<string, any>, Promise<any>.
      'jsdoc/no-restricted-syntax': ['error', {
        contexts: [{
          comment: 'JsdocBlock:has(JsdocTypeName[value="any"])',
          context: 'any',
          message: NOT_ANY,
        }],
      }],
      // The three TypeScript comments that silence an error. Fix the types instead.
      'no-warning-comments': ['error', { terms: ['@ts-ignore', '@ts-nocheck', '@ts-expect-error'], location: 'anywhere' }],
      // These return `any`. Validate what comes back (see cleanEntry in highscores.js) and say so in a disable comment:
      //   // eslint-disable-next-line no-restricted-syntax -- validated by cleanEntry
      'no-restricted-syntax': ['error',
        { selector: "CallExpression[callee.object.name='JSON'][callee.property.name='parse']", message: 'JSON.parse returns any: validate the result, and say so in a disable comment.' },
        { selector: "CallExpression[callee.property.name='json'][arguments.length=0]", message: 'Response.json() returns any: validate the result, and say so in a disable comment.' },
      ],
    },
  },
];
