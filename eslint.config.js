import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vitest from '@vitest/eslint-plugin';
import html from '@html-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier/flat';

// Purely typographic @html-eslint rules: Prettier rewrites the same
// characters, so the two would contradict each other. The list is spelled out
// because this plugin's `meta.type` does not separate formatting from the rest.
const HTML_FORMATTING_RULES = Object.fromEntries(
  [
    'attrs-newline',
    'class-spacing',
    'element-newline',
    'indent',
    'lowercase',
    'no-extra-spacing-attrs',
    'no-extra-spacing-tags',
    'no-extra-spacing-text',
    'no-multiple-empty-lines',
    'no-trailing-spaces',
    'quotes',
    'require-closing-tags',
    'sort-attrs',
  ].map((rule) => [`@html-eslint/${rule}`, 'off']),
);

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'test-results/', 'playwright-report/'] },

  // --- Application TypeScript ----------------------------------------------
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      // `strictTypeChecked` needs the TypeScript program: that is what enables
      // rules such as no-unnecessary-condition or no-floating-promises.
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // User-facing strings are French, so accented characters are expected.
      'no-irregular-whitespace': ['error', { skipStrings: true, skipComments: true }],

      // An un-awaited promise in an event handler is a silent bug: the error
      // vanishes without anything showing up on screen.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // We want to know when a `catch` swallows an error without acting on it.
      'no-empty': ['error', { allowEmptyCatch: false }],

      // Literal integers in a file name or a scale read fine in context, hence
      // no no-magic-numbers rule.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  // --- Tests ---------------------------------------------------------------
  {
    files: ['src/**/*.test.ts'],
    extends: [vitest.configs.recommended],
    rules: {
      // Tests deliberately build edge cases.
      '@typescript-eslint/no-non-null-assertion': 'off',
      'vitest/expect-expect': 'error',
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-identical-title': 'error',
    },
  },

  // --- Browser tests -------------------------------------------------------
  {
    files: ['tests/**/*.ts'],
    rules: {
      // Playwright hands work to the page as strings evaluated over there, so
      // the DOM types it returns cannot be inferred from this side.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },

  // --- Configuration files -------------------------------------------------
  {
    files: ['*.config.ts', '*.config.js'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },

  // --- HTML pages ----------------------------------------------------------
  {
    files: ['**/*.html'],
    extends: [html.configs['flat/recommended']],
    plugins: { html },
    language: 'html/html',
    rules: {
      // Accessibility: everything must be reachable from the keyboard, and every
      // field must be announced properly by a screen reader.
      '@html-eslint/require-img-alt': 'error',
      '@html-eslint/require-input-label': 'error',
      '@html-eslint/require-meta-viewport': 'error',
      '@html-eslint/require-lang': 'error',
      '@html-eslint/no-heading-inside-button': 'error',
      '@html-eslint/no-positive-tabindex': 'error',
      '@html-eslint/no-duplicate-id': 'error',
      '@html-eslint/require-button-type': 'error',

      // Prettier alone owns HTML formatting. `eslint-config-prettier` does not
      // cover @html-eslint, hence the explicit list above.
      ...HTML_FORMATTING_RULES,
    },
  },

  // Must stay last: switches off the rules that clash with the formatter.
  prettier,
);
