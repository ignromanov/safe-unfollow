import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import unusedImports from 'eslint-plugin-unused-imports';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  { ignores: [
    'dist',
    'coverage',
    'node_modules',
    'designs',
    'raw',
    'docs',
    // A sibling session's checkout. `eslint .` walks into it and fails this repo's
    // lint with ENOENT on a file that session just deleted — a failure with no
    // relation to the tree being linted. Flat config does not read .gitignore.
    'worktrees',
    // design-sync working state. Gitignoring it is not enough: flat config does not
    // read .gitignore, so a resync leaves ds-bundle/_vendor in scope and lint:strict
    // fails on bundled React with 34 errors that have nothing to do with this app.
    '.ds-sync',
    'ds-bundle',
    '.design-sync',
    '*.config.js',
    '*.config.ts',
    'scripts/**/*.js'
  ] },
  
  // Main configuration for all TypeScript files
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: {
      react: { version: '18.2' },
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'react': react,
      'unused-imports': unusedImports,
      'import': importPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // React rules
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react/react-in-jsx-scope': 'off', // Not needed in React 18+

      // TypeScript rules for unused code detection
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'off', // Disabled - too strict for type guards and complex mocking
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off', // Disabled - we use runtime checks where needed

      // Unused imports detection (primary unused code detection)
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // Import rules for better code organization
      'import/no-duplicates': 'warn',
      'import/order': 'off', // Disabled - too strict for current codebase

      // General code quality rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],

      // Code complexity rules (relaxed for existing codebase)
      'complexity': ['warn', 20],
      'max-depth': ['warn', 5],
      'max-lines-per-function': 'off', // Disabled - not useful for component files and tests
    },
  },

  // Relaxed rules for test files
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      // Allow require() in tests for dynamic imports
      '@typescript-eslint/no-require-imports': 'off',

      // Allow unused vars in tests (e.g., destructuring for partial mock)
      'unused-imports/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',

      // Allow higher complexity in test scenarios
      'complexity': ['warn', 30],
    },
  },

  // Relaxed rules for utility/helper files
  {
    files: ['**/utils/**/*.{ts,tsx}', '**/helpers/**/*.{ts,tsx}', '**/lib/**/*.{ts,tsx}'],
    rules: {
      // Allow exporting constants from component files
      'react-refresh/only-export-components': 'off',
    },
  },

  // Relaxed rules for UI component library files
  {
    files: ['**/ui/**/*.{ts,tsx}', '**/components/ui/**/*.{ts,tsx}'],
    rules: {
      // Allow exporting constants alongside components (design system pattern)
      'react-refresh/only-export-components': 'off',
    },
  }
);

