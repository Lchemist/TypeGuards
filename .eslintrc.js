module.exports = {
  env: { es6: true },
  extends: [
    'standard',
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'eol-last': [2, 'always'],
    'comma-dangle': 0,
    'no-use-before-define': 1,
    quotes: ['error', 'single', { avoidEscape: true }],
    '@typescript-eslint/ban-ts-comment': 1,
    '@typescript-eslint/no-unused-vars': [1, { varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/ban-types': [
      'error',
      {
        types: { object: false, Function: false },
        extendDefaults: true,
      },
    ],
  },
}
