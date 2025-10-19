module.exports = {
  env: {
    node: true,
    es2021: true,
    commonjs: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'commonjs',
  },
  globals: {
    exports: 'writable',
    module: 'writable',
    require: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    process: 'readonly',
    Buffer: 'readonly',
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': 'warn',
  },
};