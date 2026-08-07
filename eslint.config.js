import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vitest from '@vitest/eslint-plugin';
import html from '@html-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier/flat';

// Règles @html-eslint purement typographiques : Prettier réécrit les mêmes
// caractères, les deux se contrediraient. La liste est explicite parce que
// `meta.type` ne distingue pas la mise en forme du reste chez ce plugin.
const REGLES_DE_MISE_EN_FORME_HTML = Object.fromEntries(
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
  ].map((nom) => [`@html-eslint/${nom}`, 'off']),
);

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },

  // --- TypeScript de l'application ----------------------------------------
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      // `strictTypeChecked` a besoin du programme TypeScript : c'est ce qui
      // permet des règles comme no-unnecessary-condition ou no-floating-promises.
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
      // Le code est en français : les identifiants accentués sont voulus.
      'no-irregular-whitespace': ['error', { skipStrings: true, skipComments: true }],

      // Une promesse non attendue dans un gestionnaire d'événement est un bug
      // silencieux : l'erreur disparaît sans que rien ne s'affiche.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // On veut savoir quand un `catch` avale une erreur sans rien en faire.
      'no-empty': ['error', { allowEmptyCatch: false }],

      // Les entiers littéraux d'un nom de fichier ou d'une échelle sont
      // explicites dans leur contexte ; pas de règle no-magic-numbers.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  // --- Tests ---------------------------------------------------------------
  {
    files: ['src/**/*.test.ts'],
    extends: [vitest.configs.recommended],
    rules: {
      // Les tests construisent des cas volontairement limites.
      '@typescript-eslint/no-non-null-assertion': 'off',
      'vitest/expect-expect': 'error',
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-identical-title': 'error',
    },
  },

  // --- Fichiers de configuration -------------------------------------------
  {
    files: ['*.config.ts', '*.config.js'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },

  // --- Pages HTML ----------------------------------------------------------
  {
    files: ['**/*.html'],
    extends: [html.configs['flat/recommended']],
    plugins: { html },
    language: 'html/html',
    rules: {
      // Accessibilité : l'utilisatrice doit pouvoir tout faire au clavier et
      // chaque champ doit être annoncé correctement par un lecteur d'écran.
      '@html-eslint/require-img-alt': 'error',
      '@html-eslint/require-input-label': 'error',
      '@html-eslint/require-meta-viewport': 'error',
      '@html-eslint/require-lang': 'error',
      '@html-eslint/no-heading-inside-button': 'error',
      '@html-eslint/no-positive-tabindex': 'error',
      '@html-eslint/no-duplicate-id': 'error',
      '@html-eslint/require-button-type': 'error',

      // Prettier est seul responsable de la mise en forme du HTML.
      // `eslint-config-prettier` ne couvre pas @html-eslint, d'où cette liste.
      ...REGLES_DE_MISE_EN_FORME_HTML,
    },
  },

  // Doit rester en dernier : désactive les règles qui entrent en conflit
  // avec le formateur.
  prettier,
);
