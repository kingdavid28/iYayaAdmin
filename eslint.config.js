const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

const tsRecommendedRules = tsPlugin.configs.recommended?.rules ?? {};

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'build/**', 'android/**', 'ios/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsRecommendedRules,
    },
  },
];
